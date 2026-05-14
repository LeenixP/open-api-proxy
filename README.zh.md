# open-api-proxy

> A lightweight local API proxy that provides a single HTTP entry point for all LLM providers with automatic protocol format conversion.

open-api-proxy lets you call OpenAI, Anthropic, DeepSeek, and other major LLM APIs from a single address. Specify `provider/model` in your request, and it automatically routes to the correct provider while converting between different protocols.

---

## Features

- **Unified Entry Point**: One address for all model APIs — no more multiple configurations
- **Auto Routing**: Parses `provider/model` format and routes to the corresponding provider automatically
- **6-Way Protocol Conversion**: Full bidirectional conversion between OpenAI Chat, Anthropic Messages, and OpenAI Responses
- **Streaming Support**: Real-time SSE stream conversion with native-like experience
- **Web Management UI**: Built-in React admin panel for provider management, API testing, live logs, and system settings
- **Configuration as Code**: Single `config.yaml` file for all settings, with environment variable injection
- **Auto Update**: Built-in version checking and one-click update mechanism
- **Zero-Dependency Deployment**: Single binary / `npm start` to run

---

## Quick Start

### Install

```bash
npm install -g open-api-proxy
```

Or clone from source:

```bash
git clone https://github.com/leenixp/open-api-proxy.git
cd open-api-proxy
npm install
npm run build
```

### Configure

Create `config.yaml`:

```yaml
_schema_version: 1
server:
  port: 6312
  host: "127.0.0.1"
  cors: true

proxy:
  timeout: 120000
  keep_alive: true
  user_agent_override: ""
  preserve_headers:
    - x-request-id
    - x-ratelimit-*

providers:
  openai:
    display_name: "OpenAI"
    base_url: "https://api.openai.com/v1"
    api_key: "${OPENAI_API_KEY}"
    protocol: openai
    models:
      - gpt-4o
      - gpt-5

  anthropic:
    display_name: "Anthropic"
    base_url: "https://api.anthropic.com"
    api_key: "${ANTHROPIC_API_KEY}"
    protocol: anthropic
    models:
      - claude-sonnet-4-20250514

  deepseek:
    display_name: "DeepSeek"
    base_url: "https://api.deepseek.com/v1"
    api_key: "${DEEPSEEK_API_KEY}"
    protocol: openai
    models:
      - deepseek-chat
      - deepseek-reasoner

conversions:
  anthropic_to_openai: true
  openai_to_anthropic: true
  anthropic_to_openai_responses: true
  openai_to_anthropic_responses: false
  openai_chat_to_responses: true
  responses_to_openai_chat: true

logging:
  level: info
  dir: logs
  max_files: 10
```

### Run

```bash
# Global install
open-api-proxy

# Or from source
npm start

# Development mode (with hot reload)
npm run dev
```

After starting, visit:
- API Proxy: `http://localhost:6312`
- Management UI: `http://localhost:6312/`

---

## Configuration

`config.yaml` is the single configuration file with a layered structure:

| Section | Description |
|---------|-------------|
| `server` | Listen port, host, CORS toggle |
| `proxy` | Timeout, keep-alive, User-Agent, preserved headers |
| `providers` | Provider configs (name, URL, key, protocol, model list) |
| `conversions` | Toggles for the 6 protocol conversion directions |
| `logging` | Log level, storage directory, max retained files |

### Environment Variable Injection

`api_key` supports `${ENV_VAR}` syntax to read secrets from environment variables:

```yaml
api_key: "${OPENAI_API_KEY}"
```

Set before starting:

```bash
export OPENAI_API_KEY="sk-..."
export ANTHROPIC_API_KEY="sk-ant-..."
export DEEPSEEK_API_KEY="sk-..."
```

### Example: OpenAI

```yaml
providers:
  openai:
    display_name: "OpenAI"
    base_url: "https://api.openai.com/v1"
    api_key: "${OPENAI_API_KEY}"
    protocol: openai
    models:
      - gpt-4o
      - gpt-5
```

### Example: Anthropic

```yaml
providers:
  anthropic:
    display_name: "Anthropic"
    base_url: "https://api.anthropic.com"
    api_key: "${ANTHROPIC_API_KEY}"
    protocol: anthropic
    models:
      - claude-sonnet-4-20250514
```

### Example: DeepSeek

```yaml
providers:
  deepseek:
    display_name: "DeepSeek"
    base_url: "https://api.deepseek.com/v1"
    api_key: "${DEEPSEEK_API_KEY}"
    protocol: openai
    models:
      - deepseek-chat
      - deepseek-reasoner
```

---

## Usage

### Model Naming Format

All requests specify the model in `provider/model` format:

```
openai/gpt-4o
anthropic/claude-sonnet-4-20250514
deepseek/deepseek-chat
```

### OpenAI Chat Protocol

```bash
curl -X POST http://localhost:6312/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "anthropic/claude-sonnet-4-20250514",
    "messages": [
      {"role": "system", "content": "You are a helpful assistant."},
      {"role": "user", "content": "Hello!"}
    ],
    "stream": false
  }'
```

### Anthropic Messages Protocol

```bash
curl -X POST http://localhost:6312/v1/messages \
  -H "Content-Type: application/json" \
  -d '{
    "model": "openai/gpt-4o",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ],
    "max_tokens": 4096,
    "stream": false
  }'
```

### OpenAI Responses Protocol

```bash
curl -X POST http://localhost:6312/v1/responses \
  -H "Content-Type: application/json" \
  -d '{
    "model": "anthropic/claude-sonnet-4-20250514",
    "input": [
      {"role": "user", "content": [{"type": "input_text", "text": "Hello!"}]}
    ],
    "stream": false
  }'
```

### Streaming Requests

Set `"stream": true` to enable SSE streaming; the proxy converts stream events in real time:

```bash
curl -N -X POST http://localhost:6312/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek/deepseek-chat",
    "messages": [{"role": "user", "content": "Tell me a story"}],
    "stream": true
  }'
```

### List Models

```bash
curl http://localhost:6312/v1/models
```

Returns an aggregated list of all configured provider models in `provider/model` format.

---

## Protocol Conversion Matrix

open-api-proxy supports automatic 6-way conversion between the three major LLM API protocols:

| Source Protocol | Target Protocol | Description |
|-----------------|-----------------|-------------|
| Anthropic Messages | OpenAI Chat | Content block arrays to flat messages; supports tool_use/tool_result mapping |
| OpenAI Chat | Anthropic Messages | Flat messages to content block arrays; supports tool_calls/tool mapping |
| Anthropic Messages | OpenAI Responses | Closest architecture match; most lossless conversion |
| OpenAI Responses | Anthropic Messages | Supports reasoning and function_call mapping |
| OpenAI Chat | OpenAI Responses | messages to input array; tools format conversion |
| OpenAI Responses | OpenAI Chat | input array to messages; supports output restoration |

### Conversion Details

- **Request conversion**: The `model` field is automatically stripped of its `provider/` prefix; remaining fields are mapped per protocol
- **Response conversion**: Non-streaming responses are converted to the target protocol format as a whole
- **Stream conversion**: SSE events are converted one by one in real time, preserving the streaming experience
- **Error conversion**: Upstream error status codes and bodies are translated to the client's expected format
- **Special fields**:
  - `thinking` (Anthropic) ↔ `reasoning_effort` (OpenAI)
  - `max_tokens` ↔ `max_completion_tokens` ↔ `max_output_tokens`
  - `tool_use` / `tool_result` ↔ `tool_calls` / `tool`
  - Unmappable fields like `top_k` are dropped with debug logging

---

## Web UI

Visit `http://localhost:6312/` to open the management dashboard, which includes 5 pages:

### 1. Dashboard
View provider count, total models, uptime, and real-time health status of each provider (probed via base_url availability).

### 2. Providers
- CRUD operations for all provider configurations
- Set display name, Base URL, API key, protocol type, and model list
- All changes are written to `config.yaml` in real time

### 3. Playground
- Visually select endpoints (`/v1/chat/completions`, `/v1/messages`, `/v1/responses`)
- Choose models, fill in System Prompt and User Message
- Adjust Temperature and Max Tokens
- Toggle streaming/non-streaming and view responses in real time

### 4. Logs
Connects to `/api/logs/stream` via SSE to display proxy runtime logs live, with level-based coloring and clear action.

### 5. Settings
- Modify server port and host
- Adjust proxy timeout and log level
- Check for version updates
- Import/export configuration (JSON format)

---

## API Endpoints

### Proxy Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v1/chat/completions` | POST | OpenAI Chat protocol entry |
| `/v1/messages` | POST | Anthropic Messages protocol entry |
| `/v1/responses` | POST | OpenAI Responses protocol entry |
| `/v1/models` | GET | Aggregated model list from all providers |

### Management Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/config` | GET / PUT | Read / write full configuration |
| `/api/providers` | GET / POST | List providers / create provider |
| `/api/providers/:key` | PUT / DELETE | Update / delete a provider |
| `/api/health` | GET | Health check |
| `/api/logs` | GET | Get last 200 log entries |
| `/api/logs/stream` | GET | SSE live log stream |
| `/api/update/check` | GET | Check for new version |
| `/api/update/execute` | POST | Execute one-click update |
| `/` | GET | React management UI |

---

## Development

### Requirements

- Node.js >= 20.0.0

### Local Development

```bash
# Clone repo
git clone https://github.com/leenixp/open-api-proxy.git
cd open-api-proxy

# Install dependencies
npm install

# Start dev server (frontend + backend hot reload)
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

### Project Structure

```
open-api-proxy/
├── package.json / tsconfig.json / vite.config.ts
├── config.yaml
├── src/
│   ├── index.ts              # Entry point
│   ├── config/               # Config loader and type definitions
│   ├── server/               # Fastify server, routes, middleware
│   ├── proxy/                # Router, forwarder, stream handler
│   ├── converters/           # 6-way protocol conversion engine
│   ├── migrations/           # Config schema migrations
│   └── update/               # Version checker and update executor
├── ui/                       # React admin UI
│   └── src/pages/            # Dashboard, Providers, Playground, Logs, Settings
└── tests/                    # Unit tests + integration tests
```

---

## License

[MIT](LICENSE)
