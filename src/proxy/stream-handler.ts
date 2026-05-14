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
  });

  if (!upstreamResponse.body) {
    reply.raw.end();
    return;
  }

  const reader = upstreamResponse.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        const converted = converter
          ? converter.convertStreamChunk(trimmed, streamCtx)
          : trimmed;

        if (converted !== null) {
          reply.raw.write(converted + '\n\n');
        }
      }
    }

    // Flush remaining buffer
    if (buffer.trim()) {
      const converted = converter
        ? converter.convertStreamChunk(buffer.trim(), streamCtx)
        : buffer.trim();
      if (converted !== null) {
        reply.raw.write(converted + '\n\n');
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
