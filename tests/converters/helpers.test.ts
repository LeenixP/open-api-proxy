import { describe, it, expect } from 'vitest';
import { parseSSELine, formatSSE, isDoneChunk, safeJsonParse, estimateTokens } from '../../src/converters/helpers.js';

describe('parseSSELine', () => {
  it('should parse data line', () => {
    const result = parseSSELine('data: {"foo":"bar"}');
    expect(result).toEqual({ event: '', data: '{"foo":"bar"}' });
  });

  it('should return null for empty lines', () => {
    expect(parseSSELine('')).toBeNull();
    expect(parseSSELine('\n')).toBeNull();
  });
});

describe('formatSSE', () => {
  it('should format with event', () => {
    expect(formatSSE('test', '{}')).toBe('event: test\ndata: {}\n\n');
  });

  it('should format without event', () => {
    expect(formatSSE('', '{}')).toBe('data: {}\n\n');
  });
});

describe('isDoneChunk', () => {
  it('should detect DONE', () => {
    expect(isDoneChunk('data: [DONE]')).toBe(true);
    expect(isDoneChunk('data: {"foo":"bar"}')).toBe(false);
  });
});

describe('safeJsonParse', () => {
  it('should parse valid JSON', () => {
    expect(safeJsonParse('{"a":1}')).toEqual({ a: 1 });
  });

  it('should return empty object on invalid JSON', () => {
    expect(safeJsonParse('invalid')).toEqual({});
  });
});

describe('estimateTokens', () => {
  it('should estimate ~4 chars per token', () => {
    expect(estimateTokens('Hello World')).toBe(3);
    expect(estimateTokens('')).toBe(0);
  });
});
