const BASE = '';

// Error types
export class ApiError extends Error {
  constructor(message: string, public status: number, public details?: unknown) {
    super(message);
    this.name = 'ApiError';
  }
}

// Backend config types (mirrored from src/types.ts)
export interface ServerConfig {
  port: number;
  host: string;
  cors: boolean;
}

export interface ProxyConfig {
  timeout: number;
  keep_alive: boolean;
  user_agent_override: string;
  preserve_headers: string[];
}

export interface ConversionsConfig {
  anthropic_to_openai: boolean;
  openai_to_anthropic: boolean;
  anthropic_to_openai_responses: boolean;
  openai_to_anthropic_responses: boolean;
  openai_chat_to_responses: boolean;
  responses_to_openai_chat: boolean;
}

export interface LoggingConfig {
  level: 'debug' | 'info' | 'warn' | 'error';
  dir: string;
  max_files: number;
}

export interface ProviderConfig {
  display_name: string;
  base_url: string;
  api_key: string;
  protocol: 'openai' | 'anthropic' | 'openai-responses';
  models: string[];
}

export interface AppConfig {
  _schema_version: number;
  server: ServerConfig;
  proxy: ProxyConfig;
  providers: Record<string, ProviderConfig>;
  conversions: ConversionsConfig;
  logging: LoggingConfig;
}

export interface UpdateInfo {
  current: string;
  latest: string;
  hasUpdate: boolean;
}

export interface LogEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
}

export interface ModelsResponse {
  object: string;
  data: Array<{ id: string }>;
}

export interface ProviderPreset {
  display_name: string;
  base_url: string;
  api_key: string;
  protocol: 'openai' | 'anthropic' | 'openai-responses';
  models: string[];
  website?: string;
}

export interface HealthResponse {
  status: string;
  uptime: number;
  version: string;
  [key: string]: unknown;
}

export interface PresetsResponse {
  [key: string]: ProviderPreset;
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(BASE + url, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const message = body?.error?.message || body?.message || `Request failed with status ${res.status}`;
    throw new ApiError(message, res.status, body);
  }
  return res.json();
}

export const apiClient = {
  getConfig: () => api<AppConfig>('/api/config'),
  updateConfig: (config: AppConfig) => api<AppConfig>('/api/config', { method: 'PUT', body: JSON.stringify(config) }),
  getProviders: () => api<Record<string, ProviderConfig>>('/api/providers'),
  createProvider: (key: string, data: ProviderConfig) => api<ProviderConfig>('/api/providers', { method: 'POST', body: JSON.stringify({ key, ...data }) }),
  updateProvider: (key: string, data: Partial<ProviderConfig>) => api<ProviderConfig>(`/api/providers/${key}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteProvider: (key: string) => api<void>(`/api/providers/${key}`, { method: 'DELETE' }),
  getHealth: () => api<HealthResponse>('/api/health'),
  getLogs: () => api<LogEntry[]>('/api/logs'),
  checkUpdate: () => api<UpdateInfo>('/api/update/check'),
  executeUpdate: (authToken?: string) => {
    const headers: Record<string, string> = {};
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
    return api<{ message: string }>('/api/update/execute', { method: 'POST', headers });
  },
  getModels: () => api<ModelsResponse>('/v1/models'),
  getPresets: () => api<PresetsResponse>('/api/presets'),
  importPreset: (key: string, providerKey?: string) =>
    api<ProviderConfig>('/api/presets/' + key + '/import', { method: 'POST', body: JSON.stringify({ providerKey: providerKey || key }) }),
};
