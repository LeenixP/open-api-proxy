export function parseSSELine(line: string): { event: string; data: string } | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('data: ')) {
    return { event: '', data: trimmed.slice(6) };
  }

  return null;
}

/**
 * Parse a full SSE chunk that may contain event and data lines.
 * Example: "event: foo\ndata: {"bar":1}\n\n"
 */
export function parseSSEChunk(chunk: string): { event: string; data: string } | null {
  const lines = chunk.trim().split('\n');
  let event = '';
  let data = '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('event: ')) {
      event = trimmed.slice(7);
    } else if (trimmed.startsWith('data: ')) {
      data = trimmed.slice(6);
    }
  }

  if (!data) return null;
  return { event, data };
}

export function formatSSE(event: string, data: string): string {
  if (event) {
    return `event: ${event}\ndata: ${data}\n\n`;
  }
  return `data: ${data}\n\n`;
}

export function isDoneChunk(line: string): boolean {
  return line.trim() === 'data: [DONE]';
}

export function safeJsonParse(str: string): unknown {
  try { return JSON.parse(str); } catch { return {}; }
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
