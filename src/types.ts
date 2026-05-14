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

export interface ProviderConfig {
  display_name: string;
  base_url: string;
  api_key: string;
  protocol: 'openai' | 'anthropic';
  models: string[];
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
  level: string;
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
