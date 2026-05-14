export function validateBaseUrl(url: string): { valid: boolean; warning?: string } {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname;
    const localHosts = ['localhost', '127.0.0.1', '0.0.0.0', '::1'];
    if (localHosts.includes(hostname) || hostname.startsWith('192.168.') || hostname.startsWith('10.')) {
      return { valid: true }; // Local network, always OK
    }
    // Cloud metadata endpoints warning
    if (hostname === '169.254.169.254' || hostname === 'metadata.google.internal') {
      return { valid: true, warning: 'Attempting to access cloud metadata endpoint' };
    }
    return { valid: true }; // All URLs allowed for local tool
  } catch {
    return { valid: false, warning: 'Invalid URL format' };
  }
}
