export function validateBaseUrl(url: string): { valid: boolean; warning?: string } {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname;

    // Block cloud metadata endpoints (SSRF protection)
    if (
      hostname === '169.254.169.254' ||
      hostname === 'metadata.google.internal'
    ) {
      return { valid: false, warning: 'Cloud metadata endpoints are blocked for security' };
    }

    // Block carrier-grade NAT (100.64.0.0/10) — used by some cloud providers for internal services
    if (/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(hostname)) {
      return { valid: false, warning: 'Carrier-grade NAT addresses are blocked for security' };
    }

    // Loopback is fine for local LLM servers
    if (
      hostname.startsWith('127.') ||
      hostname === '0.0.0.0' ||
      hostname === '::1' ||
      hostname === 'localhost'
    ) {
      return { valid: true };
    }

    // Internal network ranges — allow but warn
    if (
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
    ) {
      return { valid: true, warning: 'Using internal network address' };
    }

    return { valid: true };
  } catch {
    return { valid: false, warning: 'Invalid URL format' };
  }
}
