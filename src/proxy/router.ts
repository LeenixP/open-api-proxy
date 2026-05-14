import type { AppConfig, RouteInfo } from '../types.js';

export function resolveRoute(
  config: AppConfig,
  modelField: string,
  endpointPath: string,
  stream: boolean,
): RouteInfo {
  const slashIdx = modelField.indexOf('/');
  if (slashIdx === -1) {
    throw new Error(`Invalid model format: "${modelField}". Expected "provider/model".`);
  }

  const providerKey = modelField.slice(0, slashIdx);
  const model = modelField.slice(slashIdx + 1);

  if (!model) {
    throw new Error(`Model name required after "${providerKey}/".`);
  }

  const provider = config.providers[providerKey];
  if (!provider) {
    const available = Object.keys(config.providers).join(', ');
    throw new Error(`Provider "${providerKey}" not found. Available: ${available}`);
  }

  if (!provider.models.includes(model)) {
    throw new Error(
      `Model "${model}" not found in provider "${providerKey}". Available models: ${provider.models.join(', ')}`,
    );
  }

  const sourceProtocol = endpointPathToSourceProtocol(endpointPath);
  const targetProtocol = provider.protocol;

  return { providerKey, provider, model, sourceProtocol, targetProtocol, stream };
}

function endpointPathToSourceProtocol(path: string): 'openai-chat' | 'anthropic' | 'openai-responses' {
  if (path === '/v1/chat/completions') return 'openai-chat';
  if (path === '/v1/messages') return 'anthropic';
  if (path === '/v1/responses') return 'openai-responses';
  throw new Error(`Unknown endpoint path: ${path}`);
}
