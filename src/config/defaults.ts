import type { AppConfig } from '../types.js';

export const defaults: AppConfig = {
  _schema_version: 1,
  server: {
    port: 6312,
    host: '0.0.0.0',
    cors: true,
  },
  proxy: {
    timeout: 120000,
    keep_alive: true,
    user_agent_override: '',
    preserve_headers: ['x-request-id', 'x-ratelimit-*'],
  },
  providers: {},
  conversions: {
    anthropic_to_openai: true,
    openai_to_anthropic: true,
    anthropic_to_openai_responses: true,
    openai_to_anthropic_responses: false,
    openai_chat_to_responses: true,
    responses_to_openai_chat: true,
  },
  logging: {
    level: 'info',
    dir: 'logs',
    max_files: 10,
  },
};
