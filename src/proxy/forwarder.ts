import type { RouteInfo, AppConfig } from '../types.js';

export interface UpstreamRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string;
}

export function buildUpstreamRequest(
  route: RouteInfo,
  convertedBody: Record<string, unknown>,
  rawReqHeaders: Record<string, string>,
  config: AppConfig,
): UpstreamRequest {
  const { provider } = route;

  let url = provider.base_url.replace(/\/+$/, '');

  if (route.targetProtocol === 'openai') {
    url = url + '/chat/completions';
  } else if (route.targetProtocol === 'openai-responses') {
    url = url + '/responses';
  } else if (route.targetProtocol === 'anthropic') {
    url = url + '/messages';
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Copy Accept header
  const acceptKey = Object.keys(rawReqHeaders).find(k => k.toLowerCase() === 'accept');
  if (acceptKey && rawReqHeaders[acceptKey]) {
    headers['Accept'] = rawReqHeaders[acceptKey];
  }

  // User-Agent
  if (config.proxy.user_agent_override) {
    headers['User-Agent'] = config.proxy.user_agent_override;
  } else {
    const uaKey = Object.keys(rawReqHeaders).find(k => k.toLowerCase() === 'user-agent');
    if (uaKey && rawReqHeaders[uaKey]) {
      headers['User-Agent'] = rawReqHeaders[uaKey];
    }
  }

  // Inject API key
  if (route.targetProtocol === 'anthropic') {
    headers['x-api-key'] = provider.api_key;
    headers['anthropic-version'] = '2023-06-01';
  } else {
    headers['Authorization'] = `Bearer ${provider.api_key}`;
  }

  return {
    url,
    method: 'POST',
    headers,
    body: JSON.stringify(convertedBody),
  };
}

export function preserveResponseHeaders(
  upstreamHeaders: Record<string, string>,
  config: AppConfig,
): Record<string, string> {
  const preserved: Record<string, string> = {};
  const patterns = config.proxy.preserve_headers;

  for (const [key, value] of Object.entries(upstreamHeaders)) {
    for (const pattern of patterns) {
      if (pattern.endsWith('*')) {
        const prefix = pattern.slice(0, -1);
        if (key.toLowerCase().startsWith(prefix.toLowerCase())) {
          preserved[key] = value;
        }
      } else if (key.toLowerCase() === pattern.toLowerCase()) {
        preserved[key] = value;
      }
    }
  }

  return preserved;
}
