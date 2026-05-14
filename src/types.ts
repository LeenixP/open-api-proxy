export type ProviderProtocol = 'openai' | 'anthropic' | 'openai-responses';

export interface ProviderConfig {
  display_name: string;
  base_url: string;
  api_key: string;
  protocol: ProviderProtocol;
  models: string[];
}

export interface ProviderPreset {
  display_name: string;
  base_url: string;
  api_key: string;
  protocol: ProviderProtocol;
  models: string[];
  website?: string;
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
  sourceProtocol: 'openai' | 'anthropic' | 'openai-responses';
  targetProtocol: ProviderProtocol;
  stream: boolean;
}

export interface ConvertedRequest {
  url: string;
  headers: Record<string, string>;
  body: string;
}

export interface StreamContext {
  state: Record<string, unknown>;
  // Per-request stream state is stored via index signature.
  // Converters should use typed access patterns like:
  //   ctx.state as MyStreamState
  //   ctx as unknown as { myField: string }
  [key: string]: unknown;
}

export interface Converter {
  readonly fromProtocol: string;
  readonly toProtocol: string;
  convertRequest(body: Record<string, unknown>, targetModel: string): Record<string, unknown>;
  convertResponse(body: Record<string, unknown>): Record<string, unknown>;
  convertStreamChunk(chunk: string, ctx: StreamContext): string | null;
  convertError(status: number, body: string): { status: number; body: string };
  createStreamContext?(): StreamContext;
}
