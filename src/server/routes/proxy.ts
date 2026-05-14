import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { AppConfig, RouteInfo } from '../../types.js';
import { resolveRoute } from '../../proxy/router.js';
import { buildUpstreamRequest, preserveResponseHeaders } from '../../proxy/forwarder.js';
import { proxyStreamToClient } from '../../proxy/stream-handler.js';
import { ConverterRegistry } from '../../converters/index.js';
import { healthChecker } from '../../proxy/health.js';
import { findFailover } from '../../proxy/failover.js';

export function registerProxyRoutes(app: FastifyInstance, config: AppConfig): void {
  async function handleProxy(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    let route: RouteInfo | undefined;
    try {
      const body = (request.body || {}) as Record<string, unknown>;
      const modelField = body.model as string;
      const stream = body.stream === true;
      const endpointPath = request.url.split('?')[0];

      route = resolveRoute(config, modelField, endpointPath, stream);

      // Health check + failover
      let effectiveRoute: RouteInfo = route;
      if (healthChecker.isInCooldown(route.providerKey)) {
        const failover = findFailover(config, route.providerKey, route.model);
        if (failover) {
          effectiveRoute = {
            ...route,
            providerKey: failover.providerKey,
            provider: failover.provider,
          };
          reply.header('X-Failover', 'true');
        }
      }

      let bodyToSend: Record<string, unknown> = body;
      if (ConverterRegistry.needsConversion(effectiveRoute.sourceProtocol, effectiveRoute.targetProtocol)) {
        const converter = ConverterRegistry.get(effectiveRoute.sourceProtocol, effectiveRoute.targetProtocol);
        if (converter) bodyToSend = converter.convertRequest(body, effectiveRoute.model);
      } else {
        bodyToSend = { ...body, model: effectiveRoute.model };
      }

      const headers: Record<string, string> = {};
      for (const [k, v] of Object.entries(request.headers)) {
        if (typeof v === 'string') headers[k] = v;
      }

      const upstream = buildUpstreamRequest(effectiveRoute, bodyToSend, headers, config);
      const response = await fetch(upstream.url, {
        method: upstream.method,
        headers: upstream.headers,
        body: upstream.body,
        signal: AbortSignal.timeout(config.proxy.timeout),
      });

      if (!response.ok) {
        healthChecker.recordFailure(route.providerKey);
        const errText = await response.text();
        const converter = ConverterRegistry.get(effectiveRoute.sourceProtocol, effectiveRoute.targetProtocol);
        const mapped = converter
          ? converter.convertError(response.status, errText)
          : { status: response.status, body: errText };
        const respHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
        Object.assign(
          respHeaders,
          preserveResponseHeaders(Object.fromEntries(response.headers.entries()), config),
        );
        let errorPayload: unknown;
        try {
          errorPayload = JSON.parse(mapped.body);
        } catch {
          errorPayload = { error: { message: mapped.body } };
        }
        reply.status(mapped.status).headers(respHeaders).send(errorPayload);
        return;
      }

      healthChecker.recordSuccess(route.providerKey);

      if (stream) {
        await proxyStreamToClient(response, effectiveRoute, reply);
        return;
      }

      const rawBody = await response.text();
      let responseBody: Record<string, unknown> = JSON.parse(rawBody) as Record<string, unknown>;
      if (ConverterRegistry.needsConversion(effectiveRoute.sourceProtocol, effectiveRoute.targetProtocol)) {
        const converter = ConverterRegistry.get(effectiveRoute.sourceProtocol, effectiveRoute.targetProtocol);
        if (converter) responseBody = converter.convertResponse(responseBody);
      }

      const respHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
      Object.assign(
        respHeaders,
        preserveResponseHeaders(Object.fromEntries(response.headers.entries()), config),
      );
      reply.headers(respHeaders).send(responseBody);
    } catch (err) {
      if (route) {
        healthChecker.recordFailure(route.providerKey);
      }
      const message = (err as Error).message;
      let status = 502;
      if (message.startsWith('Invalid model format') || message.startsWith('Model name required')) {
        status = 400;
      } else if (message.startsWith('Provider "') && message.includes('not found')) {
        status = 404;
      } else if (message.startsWith('Model "') && message.includes('not found')) {
        status = 404;
      } else if (message === 'Unknown endpoint path') {
        status = 404;
      }
      reply.status(status).send({ error: { message, type: 'proxy_error' } });
    }
  }

  app.post('/v1/chat/completions', handleProxy);
  app.post('/v1/messages', handleProxy);
  app.post('/v1/responses', handleProxy);
}
