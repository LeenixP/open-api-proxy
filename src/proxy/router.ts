import type { AppConfig, RouteInfo } from '../types.js';

/** Error with an HTTP status code for proxy routing failures. */
export class ProxyError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'ProxyError';
    this.statusCode = statusCode;
  }
}

export function resolveRoute(
  config: AppConfig,
  modelField: unknown,
  endpointPath: string,
  stream: boolean,
): RouteInfo {
  if (typeof modelField !== 'string' || modelField.length === 0) {
    throw new ProxyError(`Invalid model format: expected "provider/model", got ${typeof modelField}`, 400);
  }

  const slashIdx = modelField.indexOf('/');
  if (slashIdx === -1) {
    throw new ProxyError(`Invalid model format: "${modelField}". Expected "provider/model".`, 400);
  }

  const providerKey = modelField.slice(0, slashIdx);
  const model = modelField.slice(slashIdx + 1);

  if (!model) {
    throw new ProxyError(`Model name required after "${providerKey}/".`, 400);
  }

  const provider = config.providers[providerKey];
  if (!provider) {
    const available = Object.keys(config.providers).join(', ');
    throw new ProxyError(`Provider "${providerKey}" not found. Available: ${available}`, 404);
  }

  if (!provider.models.includes(model)) {
    throw new ProxyError(
      `Model "${model}" not found in provider "${providerKey}". Available models: ${provider.models.join(', ')}`,
      404,
    );
  }

  const sourceProtocol = endpointPathToSourceProtocol(endpointPath);
  const targetProtocol = provider.protocol;

  return { providerKey, provider, model, sourceProtocol, targetProtocol, stream };
}

function endpointPathToSourceProtocol(path: string): 'openai' | 'anthropic' | 'openai-responses' {
  if (path === '/v1/chat/completions') return 'openai';
  if (path === '/v1/messages') return 'anthropic';
  if (path === '/v1/responses') return 'openai-responses';
  throw new ProxyError(`Unknown endpoint path: ${path}`, 404);
}
