export function parseSSELine(line: string): { event: string; data: string } | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('data: ')) {
    return { event: '', data: trimmed.slice(6) };
  }

  // Multi-line SSE not needed for current use cases
  return null;
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
