import { describe, it, expect } from 'vitest';
import { validateBaseUrl } from '../../src/proxy/validate.js';

describe('validateBaseUrl', () => {
  it('returns valid for a valid HTTPS URL', () => {
    const result = validateBaseUrl('https://api.openai.com/v1');
    expect(result.valid).toBe(true);
    expect(result.warning).toBeUndefined();
  });

  it('returns invalid for cloud metadata endpoint (169.254.169.254)', () => {
    const result = validateBaseUrl('http://169.254.169.254/latest/meta-data');
    expect(result.valid).toBe(false);
    expect(result.warning).toContain('Cloud metadata');
  });

  it('returns valid for loopback addresses', () => {
    expect(validateBaseUrl('http://127.0.0.1:8080').valid).toBe(true);
    expect(validateBaseUrl('http://0.0.0.0:8080').valid).toBe(true);
    expect(validateBaseUrl('http://localhost:3000').valid).toBe(true);
    expect(validateBaseUrl('http://[::1]:3000').valid).toBe(true);
  });

  it('returns valid with warning for internal network addresses', () => {
    const result192 = validateBaseUrl('http://192.168.1.1:8080');
    expect(result192.valid).toBe(true);
    expect(result192.warning).toBe('Using internal network address');

    const result10 = validateBaseUrl('http://10.0.0.1:8080');
    expect(result10.valid).toBe(true);
    expect(result10.warning).toBe('Using internal network address');

    const result172 = validateBaseUrl('http://172.16.0.1:8080');
    expect(result172.valid).toBe(true);
    expect(result172.warning).toBe('Using internal network address');
  });

  it('returns invalid for invalid URL format', () => {
    const result = validateBaseUrl('not-a-url');
    expect(result.valid).toBe(false);
    expect(result.warning).toContain('Invalid URL');
  });
});
