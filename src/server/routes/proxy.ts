import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { AppConfig } from '../../types.js';
import { resolveRoute } from '../../proxy/router.js';
import { buildUpstreamRequest, preserveResponseHeaders } from '../../proxy/forwarder.js';
import { proxyStreamToClient } from '../../proxy/stream-handler.js';
import { ConverterRegistry } from '../../converters/index.js';

export function registerProxyRoutes(app: FastifyInstance, config: AppConfig): void {
  async function handleProxy(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const body = (request.body || {}) as Record<string, unknown>;
      const modelField = body.model as string;
      const stream = body.stream === true;
      const endpointPath = request.url.split('?')[0];

      const route = resolveRoute(config, modelField, endpointPath, stream);

      let bodyToSend: Record<string, unknown> = body;
      if (ConverterRegistry.needsConversion(route.sourceProtocol, route.targetProtocol)) {
        const converter = ConverterRegistry.get(route.sourceProtocol, route.targetProtocol);
        if (converter) bodyToSend = converter.convertRequest(body, route.model);
      } else {
        bodyToSend = { ...body, model: route.model };
      }

      const headers: Record<string, string> = {};
      for (const [k, v] of Object.entries(request.headers)) {
        if (typeof v === 'string') headers[k] = v;
      }

      const upstream = buildUpstreamRequest(route, bodyToSend, headers, config);
      const response = await fetch(upstream.url, {
        method: upstream.method,
        headers: upstream.headers,
        body: upstream.body,
        signal: AbortSignal.timeout(config.proxy.timeout),
      });

      if (!response.ok) {
        const errText = await response.text();
        const converter = ConverterRegistry.get(route.sourceProtocol, route.targetProtocol);
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

      if (stream) {
        await proxyStreamToClient(response, route, reply);
        return;
      }

      const rawBody = await response.text();
      let responseBody: Record<string, unknown> = JSON.parse(rawBody) as Record<string, unknown>;
      if (ConverterRegistry.needsConversion(route.sourceProtocol, route.targetProtocol)) {
        const converter = ConverterRegistry.get(route.sourceProtocol, route.targetProtocol);
        if (converter) responseBody = converter.convertResponse(responseBody);
      }

      const respHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
      Object.assign(
        respHeaders,
        preserveResponseHeaders(Object.fromEntries(response.headers.entries()), config),
      );
      reply.headers(respHeaders).send(responseBody);
    } catch (err) {
      const message = (err as Error).message;
      const status = message.includes('not found') ? 404 : message.includes('Invalid') ? 400 : 502;
      reply.status(status).send({ error: { message, type: 'proxy_error' } });
    }
  }

  app.post('/v1/chat/completions', handleProxy);
  app.post('/v1/messages', handleProxy);
  app.post('/v1/responses', handleProxy);
}
