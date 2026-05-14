import { describe, it, expect } from 'vitest';
import { ConverterRegistry } from '../../src/converters/registry.js';
import type { Converter } from '../../src/types.js';

const mockConverter: Converter = {
  fromProtocol: 'anthropic',
  toProtocol: 'openai',
  convertRequest(body) { return body; },
  convertResponse(body) { return body; },
  convertStreamChunk(chunk) { return chunk; },
  convertError(status, body) { return { status, body }; },
};

describe('ConverterRegistry', () => {
  it('should register and retrieve a converter', () => {
    ConverterRegistry.register(mockConverter);
    const found = ConverterRegistry.get('anthropic', 'openai');
    expect(found).toBe(mockConverter);
  });

  it('should return null for unregistered direction', () => {
    const found = ConverterRegistry.get('openai', 'gemini');
    expect(found).toBeNull();
  });

  it('should list registered directions', () => {
    ConverterRegistry.register(mockConverter);
    const dirs = ConverterRegistry.directions();
    expect(dirs).toContain('anthropic->openai');
  });

  it('should check if direction needs conversion', () => {
    ConverterRegistry.register(mockConverter);
    expect(ConverterRegistry.needsConversion('anthropic', 'openai')).toBe(true);
    expect(ConverterRegistry.needsConversion('openai', 'openai')).toBe(false);
    expect(ConverterRegistry.needsConversion('anthropic', 'gemini')).toBe(false);
  });
});
