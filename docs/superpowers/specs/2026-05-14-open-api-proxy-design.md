# open-api-proxy Design Spec

## Overview

A lightweight local tool that provides a single HTTP entry point for all LLM API providers with automatic protocol format conversion.
One address manages all model APIs. Configure `provider/model` in the client and it routes + translates automatically.

## Tech Stack

- **Backend**: Node.js + TypeScript + Fastify
- **Frontend**: React + TypeScript + Vite + shadcn/ui + Tailwind CSS
- **Configuration**: Single `config.yaml` file (read/write directly, no database)
- **Deployment**: Single binary / npm start, port 6312

## Architecture

```
React Web UI (static files)  ←→  Fastify HTTP Server (:6312)
                                    ├─ Proxy routes (/v1/chat/completions, /v1/messages, /v1/responses, /v1/models)
                                    ├─ Management API (/api/config, /api/providers, /api/health, /api/logs/stream, /api/update)
                                    └─ Static file serving (/ → React app)

                                   ┌─ Router (parse model → provider → target)
                                   ├─ Converter Engine (6-way protocol conversion)
                                   ├─ Forwarder (API key injection, header handling, upstream HTTP)
                                   └─ Stream Handler (SSE event bridge)
                                              │
                                   ┌──────────┼──────────┐
                                   ▼          ▼          ▼
                                OpenAI    Anthropic   Gemini ...
```

## Model Routing

Model format: `provider/model` (e.g., `openai/gpt-5`, `anthropic/claude-sonnet-4-20250514`)

- Parse `provider/model` from request body model field
- Look up provider in config.yaml
- Determine source protocol (from request endpoint) and target protocol (from provider config)
- If same protocol: pass-through. If different: invoke converter.

## Protocol Conversion Matrix (6 directions, lossless)

```
Anthropic ↔ OpenAI Chat
Anthropic ↔ OpenAI Responses
OpenAI Chat ↔ OpenAI Responses
```

Each converter handles: request body → stream SSE chunks → non-stream response → error response

Anthropic and OpenAI Responses share a "content block array" architecture, making their interconversion the most lossless. OpenAI Chat uses a flat message model, causing data loss on certain fields (top_k, thinking blocks, etc.) which are dropped with debug logging.

## config.yaml Schema

```yaml
_schema_version: 1
server:
  port: 6312
  host: "0.0.0.0"
  cors: true

proxy:
  timeout: 120000
  keep_alive: true
  user_agent_override: ""
  preserve_headers:
    - x-request-id
    - x-ratelimit-*

providers:
  <provider_key>:
    display_name: "..."
    base_url: "..."
    api_key: "${ENV_VAR}"    # supports env var expansion
    protocol: openai | anthropic | gemini
    models:
      - model-name-1
      - model-name-2

conversions:
  anthropic_to_openai: true
  openai_to_anthropic: true
  anthropic_to_openai_responses: true

logging:
  level: "info"
  dir: "logs"
  max_files: 10
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v1/chat/completions` | POST | OpenAI Chat protocol entry |
| `/v1/messages` | POST | Anthropic Messages protocol entry |
| `/v1/responses` | POST | OpenAI Responses protocol entry |
| `/v1/models` | GET | Aggregated model list from all providers |
| `/api/config` | GET/PUT | Read/write full config.yaml |
| `/api/providers` | GET/POST/PUT/DELETE | CRUD for individual providers |
| `/api/health` | GET | Health check |
| `/api/logs/stream` | GET | SSE log stream |
| `/api/update/check` | GET | Check for new version |
| `/api/update/execute` | POST | Execute update |
| `/` | GET | React management UI |

## Request/Response Handling

- **Headers**: Authorization replaced with provider API key, Content-Type/Accept preserved, configured headers passed through
- **Body**: model field stripped of `provider/` prefix, remaining fields go to converter
- **Stream**: SSE events converted between protocol formats, timeout disabled for streaming
- **Errors**: Error status codes and bodies translated to client's expected format, enriched with upstream provider info

## Web UI (5 pages)

1. **Dashboard**: provider health overview, model count, version + update notification
2. **Providers**: CRUD table for provider configs, writes to config.yaml
3. **Playground**: API test tool with request builder and streaming response viewer
4. **Logs**: Real-time log viewer via SSE, filterable
5. **Settings**: server config, proxy params, update check, config export/import

## Auto-Update System

- config.yaml tracks `_schema_version` alongside `package.json` app version
- On startup: run migration chain (v1→v2→...→current) to transform user config
- Migration rules: preserve user values, add new defaults, drop deprecated keys
- Async GitHub release check after startup, notify frontend via SSE
- One-click update: `git checkout <tag>` + `npm install` + restart
- Config survives upgrades; deprecated keys removed, new keys auto-added

## Directory Structure

```
open-api-proxy/
├── package.json / tsconfig.json / vite.config.ts
├── config.yaml
├── src/
│   ├── index.ts
│   ├── config/         # config loader + schema types
│   ├── server/         # Fastify app, routes, middleware
│   ├── proxy/          # router, forwarder, stream-handler
│   ├── converters/     # 6-way protocol conversion engine
│   ├── migrations/     # config schema migration chain
│   └── update/         # version checker + executor
├── ui/                 # React SPA
│   └── src/pages/      # Dashboard, Providers, Playground, Logs, Settings
├── tests/              # converter unit tests + e2e
└── scripts/
```

## Testing Strategy

- Converter unit tests: snapshot-based request/response/stream fixtures for all 6 directions
- Router unit tests: model parsing and provider resolution
- Integration test: start server, mock upstream, verify end-to-end proxy flow
