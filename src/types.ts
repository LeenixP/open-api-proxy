export type ProviderProtocol = 'openai' | 'anthropic' | 'openai-responses' | 'gemini';

export interface ProviderConfig {
  display_name: string;
  base_url: string;
  api_key: string;
  protocol: ProviderProtocol;
  models: string[];
}

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

export interface AppConfig {
  _schema_version: number;
  server: ServerConfig;
  proxy: ProxyConfig;
  providers: Record<string, ProviderConfig>;
  conversions: ConversionsConfig;
  logging: LoggingConfig;
}

export interface RouteInfo {
  providerKey: string;
  provider: ProviderConfig;
  model: string;
  sourceProtocol: 'openai-chat' | 'anthropic' | 'openai-responses';
  targetProtocol: ProviderProtocol;
  stream: boolean;
}

export interface ConvertedRequest {
  url: string;
  headers: Record<string, string>;
  body: string;
}

export interface Converter {
  readonly fromProtocol: string;
  readonly toProtocol: string;
  convertRequest(body: Record<string, unknown>, targetModel: string): Record<string, unknown>;
  convertResponse(body: Record<string, unknown>): Record<string, unknown>;
  convertStreamChunk(chunk: string): string | null;
  convertError(status: number, body: string): { status: number; body: string };
}
