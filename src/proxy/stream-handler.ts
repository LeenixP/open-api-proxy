import type { FastifyReply } from 'fastify';
import type { RouteInfo } from '../types.js';
import { ConverterRegistry } from '../converters/registry.js';

export async function proxyStreamToClient(
  upstreamResponse: Response,
  route: RouteInfo,
  reply: FastifyReply,
): Promise<void> {
  const converter = ConverterRegistry.get(route.sourceProtocol, route.targetProtocol);
  const streamCtx = converter?.createStreamContext?.() ?? { state: {} };

  reply.raw.writeHead(upstreamResponse.status, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '0',
    'Referrer-Policy': 'no-referrer',
  });

  if (!upstreamResponse.body) {
    reply.raw.end();
    return;
  }

  const reader = upstreamResponse.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    if (converter) {
      // With converter: parse individual lines and convert them
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          const converted = converter.convertStreamChunk(trimmed, streamCtx);
          if (converted !== null) {
            reply.raw.write(converted + '\n\n');
          }
        }
      }

      // Flush remaining buffer
      if (buffer.trim()) {
        const converted = converter.convertStreamChunk(buffer.trim(), streamCtx);
        if (converted !== null) {
          reply.raw.write(converted + '\n\n');
        }
      }
    } else {
      // No converter: pass through raw SSE data as-is, preserving framing
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Split on double newline (SSE event boundary)
        let eventEnd: number;
        while ((eventEnd = buffer.indexOf('\n\n')) !== -1) {
          const event = buffer.slice(0, eventEnd + 2);
          buffer = buffer.slice(eventEnd + 2);
          reply.raw.write(event);
        }
      }

      // Flush remaining buffer (incomplete event at stream end)
      if (buffer.length > 0) {
        reply.raw.write(buffer);
        if (!buffer.endsWith('\n\n')) {
          reply.raw.write('\n\n');
        }
      }
    }
  } catch (err) {
    const errMsg = (err as Error).message;
    const errorChunk = converter
      ? converter.convertError(500, JSON.stringify({ error: { message: errMsg } }))
      : { status: 500, body: JSON.stringify({ error: { message: errMsg } }) };
    reply.raw.write(`data: ${errorChunk.body}\n\n`);
  } finally {
    reader.releaseLock();
    reply.raw.end();
  }
}
