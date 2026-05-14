# open-api-proxy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a lightweight local API proxy that provides a single HTTP entry point for all LLM providers with automatic protocol format conversion (Anthropic ↔ OpenAI Chat ↔ OpenAI Responses).

**Architecture:** Fastify HTTP server on port 6312 serving both AI proxy endpoints (/v1/*) and management APIs (/api/*). React SPA served as static files for Web management UI. Config stored in single config.yaml file. Protocol converters use registry pattern with 6 bi-directional routes.

**Tech Stack:** Node.js + TypeScript + Fastify + pino, React + TypeScript + Vite + Tailwind CSS + shadcn/ui, js-yaml, undici, vitest

---

## File Structure

```
open-api-proxy/
├── package.json
├── tsconfig.json
├── tsconfig.ui.json
├── vite.config.ts
├── vitest.config.ts
├── tailwind.config.ts
├── postcss.config.js
├── config.yaml                      # Example default config
│
├── src/
│   ├── index.ts                     # Entry point: load config, run migrations, start server
│   ├── types.ts                     # All shared TypeScript interfaces
│   ├── config/
│   │   ├── loader.ts                # Load/parse config.yaml, expand ${ENV_VAR}
│   │   ├── writer.ts                # Write config back to config.yaml
│   │   └── defaults.ts              # Default config values
│   ├── server/
│   │   ├── app.ts                   # Fastify instance setup, plugins, error handler
│   │   ├── middleware/
│   │   │   └── logger.ts            # Request logging middleware
│   │   └── routes/
│   │       ├── proxy.ts             # POST /v1/chat/completions, /v1/messages, /v1/responses
│   │       ├── models.ts            # GET /v1/models
│   │       ├── config.ts            # GET/PUT /api/config
│   │       ├── providers.ts         # GET/POST/PUT/DELETE /api/providers
│   │       ├── health.ts            # GET /api/health
│   │       ├── logs.ts              # GET /api/logs/stream (SSE)
│   │       └── update.ts            # GET /api/update/check, POST /api/update/execute
│   ├── proxy/
│   │   ├── router.ts                # Parse provider/model, resolve provider config
│   │   ├── forwarder.ts             # Build upstream request, inject API key, handle headers
│   │   └── stream-handler.ts        # Bridge upstream SSE to client SSE via converter
│   ├── converters/
│   │   ├── registry.ts              # Register converters, route by (fromProtocol, toProtocol)
│   │   ├── base.ts                  # Converter interface
│   │   ├── anthropic-openai.ts      # Anthropic Messages ↔ OpenAI Chat Completions
│   │   ├── anthropic-responses.ts   # Anthropic Messages ↔ OpenAI Responses
│   │   ├── openai-responses.ts      # OpenAI Chat ↔ OpenAI Responses
│   │   └── helpers.ts               # Shared field mappings, content block transforms
│   ├── migrations/
│   │   ├── registry.ts              # Migration chain runner
│   │   └── v0_to_v1.ts              # Initial migration (add _schema_version)
│   └── update/
│       ├── checker.ts               # Check GitHub releases for newer version
│       └── executor.ts              # git checkout tag + npm install + restart
│
├── ui/
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── index.css                # Tailwind imports + globals
│       ├── api/
│       │   └── client.ts            # fetch wrappers for /api/* endpoints
│       ├── components/
│       │   ├── Layout.tsx            # Sidebar nav + content area
│       │   ├── UpdateBanner.tsx      # Version update notification bar
│       │   ├── ProviderEditor.tsx    # Modal form for editing a provider
│       │   ├── ModelTagInput.tsx     # Tag-style input for model list
│       │   └── LogStream.tsx         # SSE log viewer component
│       ├── pages/
│       │   ├── Dashboard.tsx
│       │   ├── Providers.tsx
│       │   ├── Playground.tsx
│       │   ├── Logs.tsx
│       │   └── Settings.tsx
│       └── lib/
│           └── utils.ts             # shadcn/ui utility (cn)
│
├── tests/
│   ├── converters/
│   │   ├── anthropic-openai.test.ts
│   │   ├── anthropic-responses.test.ts
│   │   └── openai-responses.test.ts
│   ├── proxy/
│   │   └── router.test.ts
│   └── e2e/
│       └── api-proxy.test.ts
│
└── scripts/
    └── dev.sh
```

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`, `tsconfig.json`, `tsconfig.ui.json`, `vitest.config.ts`, `vite.config.ts`, `tailwind.config.ts`, `postcss.config.js`
- Create: `scripts/dev.sh`
- Create: `src/index.ts` (placeholder)
- Create: `src/types.ts` (all shared types)

- [ ] **Step 1: Initialize package.json**

```bash
cd /home/lipeng/open-source/open-api-proxy
npm init -y
```

- [ ] **Step 2: Install backend dependencies**

```bash
npm install fastify @fastify/static @fastify/cors js-yaml semver
npm install -D typescript @types/node vitest tsx
```

- [ ] **Step 3: Install frontend dependencies**

```bash
npm install react react-dom react-router-dom
npm install -D vite @vitejs/plugin-react tailwindcss @tailwindcss/typography postcss autoprefixer
npm install -D @types/react @types/react-dom
npm install -D class-variance-authority clsx tailwind-merge lucide-react
```

- [ ] **Step 4: Configure TypeScript**

Create `tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist", "ui"]
}
```

Create `tsconfig.ui.json` for the React app:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./ui/src/*"]
    }
  },
  "include": ["ui/src/**/*.ts", "ui/src/**/*.tsx"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 5: Configure build tools**

Create `vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
```

Create `vite.config.ts`:
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  root: 'ui',
  build: {
    outDir: '../dist/ui',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'ui/src'),
    },
  },
});
```

Create `tailwind.config.ts`:
```typescript
import type { Config } from 'tailwindcss';

export default {
  content: ['./ui/src/**/*.{ts,tsx}'],
  theme: {
    extend: {},
  },
  plugins: [require('@tailwindcss/typography')],
} satisfies Config;
```

Create `postcss.config.js`:
```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 6: Add package.json scripts**

```json
{
  "scripts": {
    "dev": "bash scripts/dev.sh",
    "build": "tsc && vite build",
    "start": "node dist/index.js",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 7: Create dev script**

Create `scripts/dev.sh`:
```bash
#!/bin/bash
set -e
echo "Starting open-api-proxy in development mode..."
# Start Vite dev server in background
npx vite --config vite.config.ts &
VITE_PID=$!
# Start TypeScript compiler in watch mode
npx tsc --watch --preserveWatchOutput &
TSC_PID=$!
# Start the server with tsx
npx tsx --watch src/index.ts &
SRV_PID=$!

trap "kill $VITE_PID $TSC_PID $SRV_PID 2>/dev/null; exit 0" INT TERM
wait
```

- [ ] **Step 8: Create shared types**

Create `src/types.ts`:
```typescript
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

// Route info parsed from request
export interface RouteInfo {
  providerKey: string;
  provider: ProviderConfig;
  model: string; // stripped of provider/ prefix
  sourceProtocol: 'openai-chat' | 'anthropic' | 'openai-responses';
  targetProtocol: ProviderProtocol;
  stream: boolean;
}

// Converter interface types
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
```

- [ ] **Step 9: Create entry point placeholder**

Create `src/index.ts`:
```typescript
async function main(): Promise<void> {
  console.log('open-api-proxy starting...');
  // TODO: implemented in subsequent tasks
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
```

- [ ] **Step 10: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: Clean compilation (no errors)

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "chore: scaffold project with TypeScript, Fastify, Vite, and tooling configs"
```

---

### Task 2: Config System

**Files:**
- Create: `src/config/defaults.ts`
- Create: `src/config/loader.ts`
- Create: `src/config/writer.ts`
- Create: `config.yaml` (example)
- Create: `tests/config/loader.test.ts`

- [ ] **Step 1: Write failing test for config loader**

Create `tests/config/loader.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadConfig } from '../../src/config/loader.js';
import { writeConfig } from '../../src/config/writer.js';
import { writeFileSync, unlinkSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const tmpDir = join(tmpdir(), 'open-api-proxy-test-' + Date.now());
const configPath = join(tmpDir, 'config.yaml');

beforeEach(() => {
  mkdirSync(tmpDir, { recursive: true });
});

afterEach(() => {
  try { unlinkSync(configPath); } catch {}
  try { unlinkSync(join(tmpDir, 'logs')); } catch {}
});

describe('loadConfig', () => {
  it('should load a valid config file', () => {
    const yaml = `
server:
  port: 8080
  host: "127.0.0.1"
  cors: false
proxy:
  timeout: 30000
  keep_alive: false
  user_agent_override: ""
  preserve_headers: []
providers:
  openai:
    display_name: "OpenAI"
    base_url: "https://api.openai.com/v1"
    api_key: "sk-test123"
    protocol: openai
    models:
      - gpt-4o
conversions:
  anthropic_to_openai: true
  openai_to_anthropic: true
  anthropic_to_openai_responses: true
  openai_to_anthropic_responses: false
  openai_chat_to_responses: true
  responses_to_openai_chat: true
logging:
  level: debug
  dir: logs
  max_files: 5
`;
    writeFileSync(configPath, yaml);
    const config = loadConfig(configPath);

    expect(config.server.port).toBe(8080);
    expect(config.providers.openai.api_key).toBe('sk-test123');
    expect(config.providers.openai.models).toEqual(['gpt-4o']);
    expect(config.logging.level).toBe('debug');
  });

  it('should expand environment variable references', () => {
    process.env.TEST_API_KEY = 'env-sk-12345';
    const yaml = `
providers:
  test:
    display_name: Test
    base_url: https://api.test.com
    api_key: "\${TEST_API_KEY}"
    protocol: openai
    models: []
`;
    writeFileSync(configPath, yaml);
    const config = loadConfig(configPath);
    expect(config.providers.test.api_key).toBe('env-sk-12345');
    delete process.env.TEST_API_KEY;
  });

  it('should fill defaults for missing fields', () => {
    const yaml = `
providers: {}
`;
    writeFileSync(configPath, yaml);
    const config = loadConfig(configPath);
    expect(config.server.port).toBe(6312);
    expect(config.server.host).toBe('0.0.0.0');
    expect(config._schema_version).toBe(1);
  });

  it('should throw on malformed YAML', () => {
    writeFileSync(configPath, ':: bad :: yaml ::::');
    expect(() => loadConfig(configPath)).toThrow();
  });
});

describe('writeConfig', () => {
  it('should write config and read it back', () => {
    const yaml = `
providers:
  test:
    display_name: Test
    base_url: https://api.test.com
    api_key: sk-write-test
    protocol: openai
    models: [m1]
`;
    writeFileSync(configPath, yaml);
    const config = loadConfig(configPath);
    config.providers.test.models.push('m2');
    writeConfig(configPath, config);

    const reloaded = loadConfig(configPath);
    expect(reloaded.providers.test.models).toEqual(['m1', 'm2']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/config/loader.test.ts`
Expected: FAIL (loadConfig not implemented)

- [ ] **Step 3: Implement config defaults**

Create `src/config/defaults.ts`:
```typescript
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
```

- [ ] **Step 4: Implement config loader**

Create `src/config/loader.ts`:
```typescript
import { readFileSync, existsSync } from 'fs';
import * as yaml from 'js-yaml';
import { defaults } from './defaults.js';
import type { AppConfig } from '../types.js';

function expandEnvVars(value: string): string {
  return value.replace(/\$\{(\w+)\}/g, (_, name: string) => {
    const envVal = process.env[name];
    if (envVal === undefined) {
      throw new Error(`Environment variable \${${name}} not set`);
    }
    return envVal;
  });
}

function expandEnvInObject(obj: unknown): void {
  if (typeof obj === 'string') return; // handled at point of use
  if (Array.isArray(obj)) {
    for (const item of obj) expandEnvInObject(item);
    return;
  }
  if (obj && typeof obj === 'object') {
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (typeof value === 'string' && value.includes('${')) {
        (obj as Record<string, unknown>)[key] = expandEnvVars(value);
      } else if (typeof value === 'object' && value !== null) {
        expandEnvInObject(value);
      }
    }
  }
}

function deepMerge<T extends Record<string, unknown>>(base: T, overlay: Record<string, unknown>): T {
  const result = { ...base };
  for (const [key, val] of Object.entries(overlay)) {
    if (val !== undefined && val !== null) {
      if (typeof val === 'object' && !Array.isArray(val) && typeof result[key] === 'object' && !Array.isArray(result[key])) {
        (result as Record<string, unknown>)[key] = deepMerge(
          (result as Record<string, unknown>)[key] as Record<string, unknown>,
          val as Record<string, unknown>
        );
      } else {
        (result as Record<string, unknown>)[key] = val;
      }
    }
  }
  return result;
}

export function loadConfig(configPath: string): AppConfig {
  if (!existsSync(configPath)) {
    return { ...defaults };
  }

  const raw = readFileSync(configPath, 'utf8');
  const parsed = yaml.load(raw) as Record<string, unknown> | null;

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid config.yaml: not a valid YAML object');
  }

  // Remove _schema_version from user config before merging
  const { _schema_version: _, ...userData } = parsed;

  // Expand env vars in user config before merge
  expandEnvInObject(userData);

  // Merge defaults with user config (user values override defaults)
  const config = deepMerge(defaults as unknown as Record<string, unknown>, userData) as unknown as AppConfig;

  // Ensure _schema_version is set
  config._schema_version = (parsed._schema_version as number) || defaults._schema_version;

  // Normalize provider protocols
  for (const [key, provider] of Object.entries(config.providers)) {
    if (provider.protocol === 'openai-responses') {
      // Normalized internally; keep as-is
    }
    // Ensure models is always an array
    if (!Array.isArray(provider.models)) {
      provider.models = [];
    }
  }

  return config;
}
```

- [ ] **Step 5: Implement config writer**

Create `src/config/writer.ts`:
```typescript
import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import * as yaml from 'js-yaml';
import type { AppConfig } from '../types.js';

export function writeConfig(configPath: string, config: AppConfig): void {
  mkdirSync(dirname(configPath), { recursive: true });

  // Deep clone to avoid mutating the original
  const toWrite = structuredClone(config) as Record<string, unknown>;

  // Mask environment variable references for writing
  // (api_key values that look like env vars are written as ${VAR} references if they match)
  // For simplicity, we write values as-is since the user config file will have ${VAR} from original load
  const yamlStr = yaml.dump(toWrite, {
    indent: 2,
    lineWidth: 120,
    quotingType: '"',
    forceQuotes: false,
  });

  writeFileSync(configPath, yamlStr, 'utf8');
}
```

- [ ] **Step 6: Create example config.yaml**

Create `config.yaml`:
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
  openai:
    display_name: "OpenAI"
    base_url: "https://api.openai.com/v1"
    api_key: "${OPENAI_API_KEY}"
    protocol: openai
    models:
      - gpt-5
      - gpt-4o
      - o4-mini
  anthropic:
    display_name: "Anthropic"
    base_url: "https://api.anthropic.com"
    api_key: "${ANTHROPIC_API_KEY}"
    protocol: anthropic
    models:
      - claude-sonnet-4-20250514
      - claude-opus-4-20250514
conversions:
  anthropic_to_openai: true
  openai_to_anthropic: true
  anthropic_to_openai_responses: true
  openai_to_anthropic_responses: false
  openai_chat_to_responses: true
  responses_to_openai_chat: true
logging:
  level: "info"
  dir: "logs"
  max_files: 10
```

- [ ] **Step 7: Run tests to verify**

Run: `npx vitest run tests/config/loader.test.ts`
Expected: All tests PASS

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: implement config loader and writer with YAML support"
```

---

### Task 3: Converter Engine — Base + Registry

**Files:**
- Create: `src/converters/base.ts`
- Create: `src/converters/registry.ts`
- Create: `src/converters/helpers.ts`
- Create: `tests/converters/registry.test.ts`

- [ ] **Step 1: Write test for registry**

Create `tests/converters/registry.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { ConverterRegistry } from '../../src/converters/registry.js';
import type { Converter } from '../../src/types.js';

const mockConverter: Converter = {
  fromProtocol: 'anthropic',
  toProtocol: 'openai',
  convertRequest(body) { return body; },
  convertResponse(body) { return body; },
  convertStreamChunk(chunk) { return chunk; },
  convertError(status, body) { return { status, body }; },
};

describe('ConverterRegistry', () => {
  it('should register and retrieve a converter', () => {
    ConverterRegistry.register(mockConverter);
    const found = ConverterRegistry.get('anthropic', 'openai');
    expect(found).toBe(mockConverter);
  });

  it('should return null for unregistered direction', () => {
    const found = ConverterRegistry.get('openai', 'gemini');
    expect(found).toBeNull();
  });

  it('should list registered directions', () => {
    ConverterRegistry.register(mockConverter); // re-register OK (replaces)
    const dirs = ConverterRegistry.directions();
    expect(dirs).toContain('anthropic->openai');
  });

  it('should check if direction needs conversion', () => {
    expect(ConverterRegistry.needsConversion('anthropic', 'openai')).toBe(true);
    expect(ConverterRegistry.needsConversion('openai', 'openai')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/converters/registry.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement base converter interface**

Create `src/converters/base.ts`:
```typescript
import type { Converter } from '../types.js';

export function createConverter(
  fromProtocol: string,
  toProtocol: string,
  impl: Omit<Converter, 'fromProtocol' | 'toProtocol'>,
): Converter {
  return { fromProtocol, toProtocol, ...impl };
}
```

- [ ] **Step 4: Implement registry**

Create `src/converters/registry.ts`:
```typescript
import type { Converter } from '../types.js';

export class ConverterRegistry {
  private static converters: Map<string, Converter> = new Map();

  private static key(from: string, to: string): string {
    return `${from}->${to}`;
  }

  static register(converter: Converter): void {
    this.converters.set(this.key(converter.fromProtocol, converter.toProtocol), converter);
  }

  static get(fromProtocol: string, toProtocol: string): Converter | null {
    return this.converters.get(this.key(fromProtocol, toProtocol)) || null;
  }

  static needsConversion(fromProtocol: string, toProtocol: string): boolean {
    if (fromProtocol === toProtocol) return false;
    return this.converters.has(this.key(fromProtocol, toProtocol));
  }

  static directions(): string[] {
    return Array.from(this.converters.keys());
  }

  static clear(): void {
    this.converters.clear();
  }
}
```

- [ ] **Step 5: Create helpers**

Create `src/converters/helpers.ts`:
```typescript
// Common field mappings and content block transforms shared by all converters

export function parseSSELine(line: string): { event: string; data: string } | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  let event = '';
  let data = '';

  for (const part of trimmed.split('\n')) {
    if (part.startsWith('event: ')) {
      event = part.slice(7);
    } else if (part.startsWith('data: ')) {
      data = part.slice(6);
    }
  }

  if (!data) return null;
  return { event, data };
}

export function formatSSE(event: string, data: string): string {
  if (event) {
    return `event: ${event}\ndata: ${data}\n\n`;
  }
  return `data: ${data}\n\n`;
}

export function isDoneChunk(line: string): boolean {
  return line.trim() === 'data: [DONE]';
}

// Content block type mapping between Anthropic and Responses
export const anthropicToResponsesContentType: Record<string, string> = {
  text: 'output_text',
  tool_use: 'function_call',
  thinking: 'reasoning',
  image: 'input_image',
};

export const responsesToAnthropicContentType: Record<string, string> = {
  output_text: 'text',
  function_call: 'tool_use',
  reasoning: 'thinking',
  input_image: 'image',
};

// Role mapping
export const roleMapping: Record<string, string> = {
  user: 'user',
  assistant: 'assistant',
  system: 'system',
  tool: 'tool',
  function_call: 'assistant',
  function_call_output: 'user',
};

// Build simple text content from string
export function textContent(text: string): Record<string, unknown> {
  return { type: 'text', text };
}

// Estimate token count from string (rough: ~4 chars per token)
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
```

- [ ] **Step 6: Run tests to verify**

Run: `npx vitest run tests/converters/registry.test.ts`
Expected: All PASS

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add converter registry and helpers"
```

---

### Task 4: Anthropic ↔ OpenAI Chat Converter

**Files:**
- Create: `src/converters/anthropic-openai.ts`
- Create: `tests/converters/anthropic-openai.test.ts`

- [ ] **Step 1: Write comprehensive test**

Create `tests/converters/anthropic-openai.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { AnthropicToOpenAIChatConverter, OpenAIChatToAnthropicConverter } from '../../src/converters/anthropic-openai.js';

describe('AnthropicToOpenAIChatConverter', () => {
  const converter = AnthropicToOpenAIChatConverter;

  describe('convertRequest', () => {
    it('should convert basic text messages', () => {
      const input = {
        model: 'anthropic/claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [
          { role: 'user', content: [{ type: 'text', text: 'Hello' }] },
        ],
      };
      const result = converter.convertRequest(input, 'claude-sonnet-4-20250514');

      expect(result.model).toBe('claude-sonnet-4-20250514');
      expect(result.max_completion_tokens).toBe(1024);
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]).toEqual({ role: 'user', content: 'Hello' });
    });

    it('should convert system prompt to system message', () => {
      const input = {
        model: 'anthropic/test',
        max_tokens: 100,
        system: [{ type: 'text', text: 'You are helpful.' }],
        messages: [{ role: 'user', content: [{ type: 'text', text: 'Hi' }] }],
      };
      const result = converter.convertRequest(input, 'test');

      expect(result.messages).toHaveLength(2);
      expect(result.messages[0]).toEqual({ role: 'system', content: 'You are helpful.' });
      expect(result.messages[1]).toEqual({ role: 'user', content: 'Hi' });
    });

    it('should convert tool definitions', () => {
      const input = {
        model: 'anthropic/test',
        max_tokens: 100,
        messages: [],
        tools: [{
          name: 'get_weather',
          description: 'Get the weather',
          input_schema: {
            type: 'object',
            properties: {
              city: { type: 'string', description: 'City name' },
            },
            required: ['city'],
          },
        }],
      };
      const result = converter.convertRequest(input, 'test');

      expect(result.tools).toHaveLength(1);
      expect(result.tools[0]).toEqual({
        type: 'function',
        function: {
          name: 'get_weather',
          description: 'Get the weather',
          parameters: {
            type: 'object',
            properties: { city: { type: 'string', description: 'City name' } },
            required: ['city'],
          },
        },
      });
    });

    it('should convert assistant message with tool_use', () => {
      const input = {
        model: 'anthropic/test',
        max_tokens: 100,
        messages: [{
          role: 'assistant',
          content: [
            { type: 'text', text: 'Let me check.' },
            { type: 'tool_use', id: 'tool_123', name: 'get_weather', input: { city: 'SF' } },
          ],
        }],
      };
      const result = converter.convertRequest(input, 'test');

      expect(result.messages[0].role).toBe('assistant');
      expect(result.messages[0].content).toBe('Let me check.');
      expect(result.messages[0].tool_calls).toHaveLength(1);
      expect(result.messages[0].tool_calls[0]).toMatchObject({
        id: 'tool_123',
        type: 'function',
        function: { name: 'get_weather', arguments: '{"city":"SF"}' },
      });
    });

    it('should convert tool result message', () => {
      const input = {
        model: 'anthropic/test',
        max_tokens: 100,
        messages: [{
          role: 'user',
          content: [{ type: 'tool_result', tool_use_id: 'tool_123', content: 'Sunny, 72F' }],
        }],
      };
      const result = converter.convertRequest(input, 'test');

      expect(result.messages[0].role).toBe('tool');
      expect(result.messages[0].tool_call_id).toBe('tool_123');
      expect(result.messages[0].content).toBe('Sunny, 72F');
    });

    it('should map temperature and top_p', () => {
      const input = {
        model: 'anthropic/test',
        max_tokens: 100,
        messages: [],
        temperature: 0.7,
        top_p: 0.9,
        top_k: 50,
      };
      const result = converter.convertRequest(input, 'test');

      expect(result.temperature).toBe(0.7);
      expect(result.top_p).toBe(0.9);
      expect(result).not.toHaveProperty('top_k'); // dropped
    });
  });

  describe('convertResponse', () => {
    it('should convert a chat.completion response to Anthropic format', () => {
      const input = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        model: 'gpt-4o',
        choices: [{
          index: 0,
          message: { role: 'assistant', content: 'Hello! How can I help?' },
          finish_reason: 'stop',
        }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      };
      const result = converter.convertResponse(input);

      expect(result.id).toBe('chatcmpl-123');
      expect(result.type).toBe('message');
      expect(result.role).toBe('assistant');
      expect(result.content).toHaveLength(1);
      expect(result.content[0]).toEqual({ type: 'text', text: 'Hello! How can I help?' });
      expect(result.stop_reason).toBe('end_turn');
      expect(result.usage).toEqual({ input_tokens: 10, output_tokens: 5 });
    });

    it('should convert response with tool calls', () => {
      const input = {
        id: 'chatcmpl-456',
        object: 'chat.completion',
        model: 'gpt-4o',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [{
              id: 'call_abc',
              type: 'function',
              function: { name: 'get_weather', arguments: '{"city":"NYC"}' },
            }],
          },
          finish_reason: 'tool_calls',
        }],
        usage: { prompt_tokens: 5, completion_tokens: 10, total_tokens: 15 },
      };
      const result = converter.convertResponse(input);

      expect(result.stop_reason).toBe('tool_use');
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('tool_use');
      expect(result.content[0].id).toBe('call_abc');
      expect(result.content[0].name).toBe('get_weather');
      expect(result.content[0].input).toEqual({ city: 'NYC' });
    });
  });

  describe('convertStreamChunk', () => {
    it('should convert delta content to Anthropic content_block_delta', () => {
      const chunk = 'data: {"choices":[{"delta":{"content":"Hello"},"index":0}]}';
      const result = converter.convertStreamChunk(chunk);

      expect(result).toBe('data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello"}}');
    });

    it('should return null for empty delta', () => {
      const chunk = 'data: {"choices":[{"delta":{},"index":0}]}';
      const result = converter.convertStreamChunk(chunk);

      expect(result).toBeNull();
    });

    it('should handle tool call delta', () => {
      const chunk = 'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"foo"}}]},"index":0}]}';
      const result = converter.convertStreamChunk(chunk);

      expect(result).toContain('content_block_delta');
      expect(result).toContain('input_json_delta');
    });

    it('should handle [DONE]', () => {
      const chunk = 'data: [DONE]';
      const result = converter.convertStreamChunk(chunk);

      expect(result).toBe('data: {"type":"message_stop"}');
    });
  });
});

describe('OpenAIChatToAnthropicConverter', () => {
  const converter = OpenAIChatToAnthropicConverter;

  describe('convertRequest', () => {
    it('should convert basic messages to Anthropic format', () => {
      const input = {
        model: 'openai/gpt-4o',
        max_completion_tokens: 1024,
        messages: [
          { role: 'system', content: 'You are helpful.' },
          { role: 'user', content: 'Hello' },
        ],
      };
      const result = converter.convertRequest(input, 'gpt-4o');

      expect(result.model).toBe('gpt-4o');
      expect(result.max_tokens).toBe(1024);
      expect(result.system).toEqual([{ type: 'text', text: 'You are helpful.' }]);
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].role).toBe('user');
      expect(result.messages[0].content).toEqual([{ type: 'text', text: 'Hello' }]);
    });

    it('should convert user message with image_url', () => {
      const input = {
        model: 'openai/gpt-4o',
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: 'What is this?' },
            { type: 'image_url', image_url: { url: 'data:image/png;base64,abc123', detail: 'high' } },
          ],
        }],
      };
      const result = converter.convertRequest(input, 'gpt-4o');

      expect(result.messages[0].content).toHaveLength(2);
      expect(result.messages[0].content[0]).toEqual({ type: 'text', text: 'What is this?' });
      expect(result.messages[0].content[1].type).toBe('image');
      expect(result.messages[0].content[1].source?.data).toBe('abc123');
      expect(result.messages[0].content[1].source?.media_type).toBe('image/png');
    });

    it('should convert tool call message', () => {
      const input = {
        model: 'openai/gpt-4o',
        messages: [{
          role: 'assistant',
          content: 'Let me check.',
          tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'search', arguments: '{"q":"test"}' } }],
        }],
      };
      const result = converter.convertRequest(input, 'gpt-4o');

      expect(result.messages[0].role).toBe('assistant');
      expect(result.messages[0].content).toHaveLength(2);
      expect(result.messages[0].content[0]).toEqual({ type: 'text', text: 'Let me check.' });
      expect(result.messages[0].content[1].type).toBe('tool_use');
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/converters/anthropic-openai.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement AnthropicToOpenAIChatConverter**

Create `src/converters/anthropic-openai.ts`:
```typescript
import type { Converter } from '../types.js';
import { createConverter } from './base.js';
import { parseSSELine, formatSSE, isDoneChunk } from './helpers.js';

// Anthropic Messages → OpenAI Chat Completions
export const AnthropicToOpenAIChatConverter: Converter = createConverter('anthropic', 'openai', {
  convertRequest(body: Record<string, unknown>, targetModel: string): Record<string, unknown> {
    const result: Record<string, unknown> = { model: targetModel };

    // Map max_tokens → max_completion_tokens
    if (body.max_tokens !== undefined) result.max_completion_tokens = body.max_tokens;

    // Map temperature, top_p (drop top_k)
    if (body.temperature !== undefined) result.temperature = body.temperature;
    if (body.top_p !== undefined) result.top_p = body.top_p;

    // Map system prompt
    const messages: Record<string, unknown>[] = [];
    if (body.system) {
      const sysText = extractAnthropicSystemText(body.system);
      if (sysText) {
        messages.push({ role: 'system', content: sysText });
      }
    }

    // Map messages
    const anthropicMessages = body.messages as Array<Record<string, unknown>>;
    if (anthropicMessages) {
      for (const msg of anthropicMessages) {
        const converted = convertAnthropicMessageToOpenAI(msg);
        if (converted) messages.push(converted);
      }
    }
    result.messages = messages;

    // Map tools
    if (Array.isArray(body.tools) && (body.tools as unknown[]).length > 0) {
      result.tools = (body.tools as Array<Record<string, unknown>>).map(convertAnthropicToolToOpenAI);
      if (body.tool_choice) {
        result.tool_choice = convertAnthropicToolChoice(body.tool_choice as Record<string, unknown>);
      }
    }

    // Map stop_sequences → stop
    if (Array.isArray(body.stop_sequences)) result.stop = body.stop_sequences;

    // Map thinking budget → reasoning_effort
    if (body.thinking) {
      const thinking = body.thinking as Record<string, unknown>;
      if (thinking.type === 'enabled' && thinking.budget_tokens) {
        const budget = thinking.budget_tokens as number;
        if (budget <= 4000) result.reasoning_effort = 'low';
        else if (budget <= 16000) result.reasoning_effort = 'medium';
        else result.reasoning_effort = 'high';
      }
    }

    // Drop Anthropic-specific fields
    // metadata, service_tier, context_management not supported by OpenAI

    return result;
  },

  convertResponse(body: Record<string, unknown>): Record<string, unknown> {
    if (body.error) return body; // pass through errors

    const choice = ((body.choices as Array<Record<string, unknown>>)?.[0]) || {};
    const message = choice.message as Record<string, unknown> || {};
    const usage = body.usage as Record<string, number> || {};

    const content: Record<string, unknown>[] = [];

    if (message.content) {
      content.push({ type: 'text', text: message.content });
    }

    if (Array.isArray(message.tool_calls)) {
      for (const tc of message.tool_calls as Array<Record<string, unknown>>) {
        const fn = tc.function as Record<string, unknown>;
        content.push({
          type: 'tool_use',
          id: tc.id,
          name: fn?.name,
          input: safeJsonParse(fn?.arguments as string || '{}'),
        });
      }
    }

    return {
      id: body.id,
      type: 'message',
      role: 'assistant',
      content,
      stop_reason: mapOAIStopReason(choice.finish_reason as string),
      usage: {
        input_tokens: usage.prompt_tokens || 0,
        output_tokens: usage.completion_tokens || 0,
      },
      model: body.model,
    };
  },

  convertStreamChunk(rawLine: string): string | null {
    if (isDoneChunk(rawLine)) {
      return formatSSE('', '{"type":"message_stop"}');
    }

    const parsed = parseSSELine(rawLine);
    if (!parsed) return null;

    try {
      const chunk = JSON.parse(parsed.data);
      const choice = chunk.choices?.[0];
      const delta = choice?.delta;

      if (!delta) return null;

      // Handle content delta
      if (delta.content) {
        return formatSSE('', JSON.stringify({
          type: 'content_block_delta',
          index: 0,
          delta: { type: 'text_delta', text: delta.content },
        }));
      }

      // Handle tool call delta
      if (delta.tool_calls) {
        const tc = delta.tool_calls[0];
        if (tc?.function?.arguments) {
          return formatSSE('', JSON.stringify({
            type: 'content_block_delta',
            index: 0,
            delta: {
              type: 'input_json_delta',
              partial_json: tc.function.arguments,
            },
          }));
        }
        if (tc?.function?.name) {
          return formatSSE('', JSON.stringify({
            type: 'content_block_start',
            index: 0,
            content_block: {
              type: 'tool_use',
              id: tc.id || '',
              name: tc.function.name,
              input: {},
            },
          }));
        }
      }

      // Handle finish_reason
      if (choice.finish_reason) {
        const stopReason = mapOAIStopReason(choice.finish_reason as string);
        return formatSSE('', JSON.stringify({
          type: 'message_delta',
          delta: { stop_reason: stopReason, stop_sequence: null },
          usage: chunk.usage ? {
            input_tokens: chunk.usage.prompt_tokens || 0,
            output_tokens: chunk.usage.completion_tokens || 0,
          } : undefined,
        }));
      }

      return null;
    } catch {
      return null;
    }
  },

  convertError(status: number, body: string): { status: number; body: string } {
    try {
      const parsed = JSON.parse(body);
      if (parsed.type === 'error' || parsed.error) {
        const err = parsed.error || parsed;
        return {
          status,
          body: JSON.stringify({
            error: {
              message: err.message || err.type || 'Unknown error',
              type: mapAnthropicErrorType(err.type as string),
              code: err.type || null,
            },
          }),
        };
      }
    } catch {}
    return { status, body };
  },
});

// OpenAI Chat → Anthropic Messages
export const OpenAIChatToAnthropicConverter: Converter = createConverter('openai', 'anthropic', {
  convertRequest(body: Record<string, unknown>, targetModel: string): Record<string, unknown> {
    const result: Record<string, unknown> = { model: targetModel };

    // Map max_completion_tokens → max_tokens
    if (body.max_completion_tokens !== undefined) result.max_tokens = body.max_completion_tokens;
    if (body.max_tokens !== undefined) result.max_tokens = body.max_tokens;

    // Map temperature, top_p
    if (body.temperature !== undefined) result.temperature = body.temperature;
    if (body.top_p !== undefined) result.top_p = body.top_p;

    // Map stop → stop_sequences
    if (body.stop) result.stop_sequences = body.stop;

    const openaiMessages = body.messages as Array<Record<string, unknown>> || [];
    const anthropicMessages: Record<string, unknown>[] = [];
    let systemBlocks: Record<string, unknown>[] = [];

    for (const msg of openaiMessages) {
      if (msg.role === 'system') {
        systemBlocks.push({ type: 'text', text: msg.content });
      } else {
        const converted = convertOpenAIMessageToAnthropic(msg);
        if (converted) anthropicMessages.push(converted);
      }
    }

    if (systemBlocks.length > 0) {
      result.system = systemBlocks;
    }
    result.messages = anthropicMessages;

    // Map tools
    if (Array.isArray(body.tools) && (body.tools as unknown[]).length > 0) {
      result.tools = (body.tools as Array<Record<string, unknown>>).map(convertOpenAIToolToAnthropic);
      if (body.tool_choice) {
        result.tool_choice = convertOpenAIToolChoice(body.tool_choice as string | Record<string, unknown>);
      }
    }

    // Map reasoning_effort → thinking budget (approximate)
    if (body.reasoning_effort) {
      const effortToTokens: Record<string, number> = { low: 2000, medium: 8000, high: 16000 };
      const budget = effortToTokens[body.reasoning_effort as string] || 4000;
      result.thinking = { type: 'enabled', budget_tokens: budget };
    }

    // Map response_format (json_schema) → tool_use prefill
    if (body.response_format) {
      // Anthropic doesn't have response_format; handled via tool with structured output
      // This is a best-effort conversion
    }

    return result;
  },

  convertResponse(body: Record<string, unknown>): Record<string, unknown> {
    if (!body.content && !body.stop_reason) return body;

    const content = body.content as Array<Record<string, unknown>> || [];
    const choices = [{
      index: 0,
      message: convertAnthropicContentToOpenAIMessage(content, body.stop_reason as string),
      finish_reason: mapAnthropicStopReason(body.stop_reason as string),
    }];

    const usage = body.usage as Record<string, number> || {};

    return {
      id: body.id || '',
      object: 'chat.completion',
      model: body.model || '',
      created: Math.floor(Date.now() / 1000),
      choices,
      usage: {
        prompt_tokens: usage.input_tokens || 0,
        completion_tokens: usage.output_tokens || 0,
        total_tokens: (usage.input_tokens || 0) + (usage.output_tokens || 0),
      },
    };
  },

  convertStreamChunk(rawLine: string): string | null {
    const parsed = parseSSELine(rawLine);
    if (!parsed) return null;

    try {
      const event = JSON.parse(parsed.data);

      switch (event.type) {
        case 'message_start':
          return formatSSE('', JSON.stringify({
            choices: [{ delta: { role: 'assistant' }, index: 0 }],
          }));

        case 'content_block_start': {
          const block = event.content_block;
          if (block?.type === 'text') {
            return formatSSE('', JSON.stringify({
              choices: [{ delta: { content: block.text || '' }, index: 0 }],
            }));
          }
          if (block?.type === 'tool_use') {
            return formatSSE('', JSON.stringify({
              choices: [{
                delta: {
                  tool_calls: [{
                    index: 0,
                    id: block.id,
                    type: 'function',
                    function: { name: block.name, arguments: '' },
                  }],
                },
                index: 0,
              }],
            }));
          }
          return null;
        }

        case 'content_block_delta': {
          const delta = event.delta;
          if (delta?.type === 'text_delta') {
            return formatSSE('', JSON.stringify({
              choices: [{ delta: { content: delta.text }, index: 0 }],
            }));
          }
          if (delta?.type === 'input_json_delta') {
            return formatSSE('', JSON.stringify({
              choices: [{
                delta: {
                  tool_calls: [{ index: 0, function: { arguments: delta.partial_json } }],
                },
                index: 0,
              }],
            }));
          }
          return null;
        }

        case 'message_delta': {
          const delta = event.delta;
          const finishReason = delta?.stop_reason
            ? mapAnthropicStopReason(delta.stop_reason as string)
            : 'stop';
          const result: Record<string, unknown> = {
            choices: [{ finish_reason: finishReason, index: 0 }],
          };
          if (event.usage) {
            result.usage = {
              prompt_tokens: event.usage.input_tokens || 0,
              completion_tokens: event.usage.output_tokens || 0,
              total_tokens: (event.usage.input_tokens || 0) + (event.usage.output_tokens || 0),
            };
          }
          return formatSSE('', JSON.stringify(result));
        }

        case 'message_stop':
          return formatSSE('', '[DONE]');

        case 'error':
          return formatSSE('', JSON.stringify({
            error: { message: event.error?.message || 'Stream error', type: event.error?.type },
          }));

        default:
          return null;
      }
    } catch {
      return null;
    }
  },

  convertError(status: number, body: string): { status: number; body: string } {
    try {
      const parsed = JSON.parse(body);
      if (parsed.error) {
        return {
          status,
          body: JSON.stringify({
            type: 'error',
            error: {
              type: mapOAIErrorType(parsed.error.type as string),
              message: parsed.error.message || 'Unknown error',
            },
          }),
        };
      }
    } catch {}
    return { status, body };
  },
});

// --- Helper functions ---

function extractAnthropicSystemText(system: unknown): string {
  if (typeof system === 'string') return system;
  if (Array.isArray(system)) {
    return (system as Array<Record<string, unknown>>)
      .filter((b) => b.type === 'text')
      .map((b) => b.text as string)
      .join('\n');
  }
  return '';
}

function convertAnthropicMessageToOpenAI(msg: Record<string, unknown>): Record<string, unknown> | null {
  const role = msg.role as string;
  const content = msg.content as Array<Record<string, unknown>>;

  if (role === 'user') {
    if (!content || content.length === 0) return null;
    if (content.length === 1 && content[0].type === 'text' && !content[0].type?.startsWith?.('tool_result')) {
      return { role: 'user', content: content[0].text };
    }
    // Multiple content blocks — handle tool_result and text/images
    const toolResults: Record<string, unknown>[] = [];
    const other: Record<string, unknown>[] = [];
    for (const block of content) {
      if (block.type === 'tool_result') {
        toolResults.push({ role: 'tool', tool_call_id: block.tool_use_id, content: block.content });
      } else {
        other.push(block);
      }
    }
    if (toolResults.length > 0 && other.length === 0) {
      return toolResults[0]; // single tool_result
    }
    if (other.length === 1 && other[0].type === 'text') {
      return { role: 'user', content: other[0].text };
    }
    // Multi-content: convert to array format
    const parts = other.map(convertAnthropicContentBlockToOpenAI).filter(Boolean);
    return { role: 'user', content: parts.length > 1 ? parts : parts[0] || '' };
  }

  if (role === 'assistant') {
    const result: Record<string, unknown> = { role: 'assistant' };
    const textBlocks: string[] = [];
    const toolCalls: Record<string, unknown>[] = [];

    for (const block of (content || [])) {
      if (block.type === 'text') {
        textBlocks.push(block.text as string);
      } else if (block.type === 'tool_use') {
        toolCalls.push({
          id: block.id,
          type: 'function',
          function: {
            name: block.name,
            arguments: typeof block.input === 'object' ? JSON.stringify(block.input) : (block.input || '{}'),
          },
        });
      }
    }

    result.content = textBlocks.join('\n') || null;
    if (toolCalls.length > 0) {
      result.tool_calls = toolCalls;
    }
    return result;
  }

  return null;
}

function convertOpenAIMessageToAnthropic(msg: Record<string, unknown>): Record<string, unknown> | null {
  const role = msg.role as string;

  if (role === 'user') {
    const content = msg.content;
    if (typeof content === 'string') {
      return { role: 'user', content: [{ type: 'text', text: content }] };
    }
    if (Array.isArray(content)) {
      const blocks = (content as Array<Record<string, unknown>>).map(convertOpenAIContentPartToAnthropic).filter(Boolean);
      return { role: 'user', content: blocks };
    }
    return null;
  }

  if (role === 'assistant') {
    const blocks: Record<string, unknown>[] = [];
    if (msg.content && msg.content !== '' && msg.content !== null) {
      blocks.push({ type: 'text', text: msg.content });
    }
    if (Array.isArray(msg.tool_calls)) {
      for (const tc of msg.tool_calls as Array<Record<string, unknown>>) {
        const fn = tc.function as Record<string, unknown>;
        blocks.push({
          type: 'tool_use',
          id: tc.id,
          name: fn?.name,
          input: safeJsonParse(fn?.arguments as string || '{}'),
        });
      }
    }
    return { role: 'assistant', content: blocks };
  }

  if (role === 'tool') {
    return {
      role: 'user',
      content: [{ type: 'tool_result', tool_use_id: msg.tool_call_id, content: msg.content }],
    };
  }

  return null;
}

function convertAnthropicContentBlockToOpenAI(block: Record<string, unknown>): unknown {
  if (block.type === 'text') return { type: 'text', text: block.text };
  if (block.type === 'image') {
    return {
      type: 'image_url',
      image_url: {
        url: `data:${block.source?.media_type || 'image/jpeg'};base64,${block.source?.data || ''}`,
      },
    };
  }
  return null;
}

function convertOpenAIContentPartToAnthropic(part: Record<string, unknown>): Record<string, unknown> | null {
  if (part.type === 'text') return { type: 'text', text: part.text };
  if (part.type === 'image_url') {
    const url = (part.image_url as Record<string, string>)?.url || '';
    const match = url.match(/^data:(image\/\w+);base64,(.+)$/);
    if (match) {
      return { type: 'image', source: { type: 'base64', media_type: match[1], data: match[2] } };
    }
    return { type: 'image', source: { type: 'url', url } };
  }
  return null;
}

function convertAnthropicContentToOpenAIMessage(
  content: Array<Record<string, unknown>>,
  stopReason?: string,
): Record<string, unknown> {
  const message: Record<string, unknown> = { role: 'assistant' };
  const texts: string[] = [];
  const toolCalls: Record<string, unknown>[] = [];

  for (const block of content) {
    if (block.type === 'text') texts.push(block.text as string);
    else if (block.type === 'tool_use') {
      toolCalls.push({
        id: block.id,
        type: 'function',
        function: {
          name: block.name,
          arguments: JSON.stringify(block.input),
        },
      });
    }
  }

  message.content = texts.join('\n') || null;
  if (toolCalls.length > 0) message.tool_calls = toolCalls;
  return message;
}

function convertAnthropicToolToOpenAI(tool: Record<string, unknown>): Record<string, unknown> {
  return {
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.input_schema,
    },
  };
}

function convertOpenAIToolToAnthropic(tool: Record<string, unknown>): Record<string, unknown> {
  const fn = tool.function as Record<string, unknown> || {};
  return {
    name: fn.name,
    description: fn.description,
    input_schema: fn.parameters,
  };
}

function convertAnthropicToolChoice(tc: Record<string, unknown>): unknown {
  if (tc.type === 'auto') return 'auto';
  if (tc.type === 'any') return 'required';
  if (tc.type === 'tool' && tc.name) return { type: 'function', function: { name: tc.name } };
  return 'auto';
}

function convertOpenAIToolChoice(tc: string | Record<string, unknown>): unknown {
  if (tc === 'auto') return { type: 'auto' };
  if (tc === 'required') return { type: 'any' };
  if (typeof tc === 'object') {
    const fn = (tc as Record<string, unknown>).function as Record<string, unknown>;
    if (fn?.name) return { type: 'tool', name: fn.name };
  }
  return { type: 'auto' };
}

function mapOAIStopReason(reason: string | undefined): string {
  const map: Record<string, string> = {
    stop: 'end_turn',
    length: 'max_tokens',
    tool_calls: 'tool_use',
    content_filter: 'end_turn',
  };
  return map[reason || ''] || 'end_turn';
}

function mapAnthropicStopReason(reason: string | undefined): string {
  const map: Record<string, string> = {
    end_turn: 'stop',
    max_tokens: 'length',
    tool_use: 'tool_calls',
    stop_sequence: 'stop',
  };
  return map[reason || ''] || 'stop';
}

function mapAnthropicErrorType(type: string): string {
  const map: Record<string, string> = {
    invalid_request_error: 'invalid_request_error',
    authentication_error: 'authentication_error',
    permission_error: 'insufficient_quota',
    not_found_error: 'not_found_error',
    rate_limit_error: 'rate_limit_error',
    api_error: 'server_error',
    overloaded_error: 'server_error',
  };
  return map[type] || 'api_error';
}

function mapOAIErrorType(type: string): string {
  const map: Record<string, string> = {
    invalid_request_error: 'invalid_request_error',
    authentication_error: 'authentication_error',
    insufficient_quota: 'permission_error',
    rate_limit_error: 'rate_limit_error',
    server_error: 'api_error',
  };
  return map[type] || type;
}

function safeJsonParse(str: string): unknown {
  try { return JSON.parse(str); } catch { return {}; }
}
```

- [ ] **Step 4: Run tests to verify**

Run: `npx vitest run tests/converters/anthropic-openai.test.ts`
Expected: All PASS

- [ ] **Step 5: Fix any test issues and re-run**

Debug and fix any failing assertions.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: implement Anthropic ↔ OpenAI Chat converter"
```

---

### Task 5: Anthropic ↔ OpenAI Responses Converter

**Files:**
- Create: `src/converters/anthropic-responses.ts`
- Create: `tests/converters/anthropic-responses.test.ts`

- [ ] **Step 1: Write test for An↔Responses**

Create `tests/converters/anthropic-responses.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { AnthropicToResponsesConverter, ResponsesToAnthropicConverter } from '../../src/converters/anthropic-responses.js';

describe('AnthropicToResponsesConverter', () => {
  const conv = AnthropicToResponsesConverter;

  describe('convertRequest', () => {
    it('should convert basic message', () => {
      const input = {
        model: 'anthropic/test',
        max_tokens: 100,
        messages: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
      };
      const result = conv.convertRequest(input, 'test');
      expect(result.model).toBe('test');
      expect(result.max_output_tokens).toBe(100);
      expect(result.input).toEqual([{ role: 'user', content: [{ type: 'input_text', text: 'Hello' }] }]);
    });

    it('should convert system to instructions', () => {
      const input = {
        model: 'anthropic/test',
        max_tokens: 100,
        system: 'Be helpful',
        messages: [{ role: 'user', content: [{ type: 'text', text: 'Hi' }] }],
      };
      const result = conv.convertRequest(input, 'test');
      expect(result.instructions).toBe('Be helpful');
    });

    it('should convert tools', () => {
      const input = {
        model: 'anthropic/test',
        max_tokens: 100,
        messages: [],
        tools: [{ name: 'search', description: 'Search web', input_schema: { type: 'object', properties: {} } }],
      };
      const result = conv.convertRequest(input, 'test');
      expect(result.tools).toHaveLength(1);
      expect(result.tools[0].type).toBe('function');
      expect(result.tools[0].name).toBe('search');
    });

    it('should convert thinking budget', () => {
      const input = {
        model: 'anthropic/test',
        max_tokens: 100,
        messages: [],
        thinking: { type: 'enabled', budget_tokens: 8000 },
      };
      const result = conv.convertRequest(input, 'test');
      expect(result.reasoning).toBeDefined();
      expect(result.reasoning.effort).toBe('medium');
    });
  });

  describe('convertResponse', () => {
    it('should convert Responses output to Anthropic format', () => {
      const input = {
        id: 'resp_123',
        object: 'response',
        model: 'test',
        status: 'completed',
        output: [
          { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'Hi!' }] },
        ],
        usage: { input_tokens: 5, output_tokens: 3, total_tokens: 8 },
      };
      const result = conv.convertResponse(input);
      expect(result.type).toBe('message');
      expect(result.role).toBe('assistant');
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toBe('Hi!');
    });
  });

  describe('convertStreamChunk', () => {
    it('should convert response.created', () => {
      const chunk = 'data: {"type":"response.created","response":{"id":"resp_1"}}';
      const result = conv.convertStreamChunk(chunk);
      expect(result).toContain('message_start');
    });

    it('should convert text.delta', () => {
      const chunk = 'data: {"type":"response.text.delta","delta":"Hello"}';
      const result = conv.convertStreamChunk(chunk);
      expect(result).toContain('content_block_delta');
      expect(result).toContain('text_delta');
    });

    it('should convert response.completed', () => {
      const chunk = 'data: {"type":"response.completed","response":{"status":"completed","usage":{"input_tokens":10,"output_tokens":5,"total_tokens":15}}}';
      const result = conv.convertStreamChunk(chunk);
      expect(result).toContain('message_delta');
    });
  });
});

describe('ResponsesToAnthropicConverter', () => {
  const conv = ResponsesToAnthropicConverter;

  describe('convertRequest', () => {
    it('should convert basic input', () => {
      const input = {
        model: 'openai/test',
        input: [{ role: 'user', content: [{ type: 'input_text', text: 'Hello' }] }],
      };
      const result = conv.convertRequest(input, 'test');
      expect(result.model).toBe('test');
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]).toEqual({ role: 'user', content: [{ type: 'text', text: 'Hello' }] });
    });

    it('should convert instructions to system', () => {
      const input = {
        model: 'openai/test',
        instructions: 'Be helpful',
        input: [],
      };
      const result = conv.convertRequest(input, 'test');
      expect(result.system).toEqual([{ type: 'text', text: 'Be helpful' }]);
    });

    it('should convert reasoning to thinking', () => {
      const input = {
        model: 'openai/test',
        input: [],
        reasoning: { effort: 'high' },
      };
      const result = conv.convertRequest(input, 'test');
      expect(result.thinking).toBeDefined();
      expect(result.thinking.budget_tokens).toBe(16000);
    });
  });

  describe('convertStreamChunk', () => {
    it('should convert message_start to response.created', () => {
      const chunk = 'data: {"type":"message_start","message":{"id":"msg_1","type":"message","role":"assistant","content":[],"model":"test","usage":{"input_tokens":0,"output_tokens":0}}}';
      const result = conv.convertStreamChunk(chunk);
      expect(result).not.toBeNull();
      expect(result).toContain('response.created');
    });

    it('should convert text_delta', () => {
      const chunk = 'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hi"}}';
      const result = conv.convertStreamChunk(chunk);
      expect(result).toContain('response.text.delta');
      expect(result).toContain('"Hi"');
    });

    it('should convert message_stop', () => {
      const chunk = 'data: {"type":"message_stop"}';
      const result = conv.convertStreamChunk(chunk);
      expect(result).toContain('response.completed');
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/converters/anthropic-responses.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement AnthropicToResponsesConverter and ResponsesToAnthropicConverter**

Create `src/converters/anthropic-responses.ts`:
```typescript
import type { Converter } from '../types.js';
import { createConverter } from './base.js';
import { parseSSELine, formatSSE, isDoneChunk, estimateTokens } from './helpers.js';

export const AnthropicToResponsesConverter: Converter = createConverter('anthropic', 'openai-responses', {
  convertRequest(body: Record<string, unknown>, targetModel: string): Record<string, unknown> {
    const result: Record<string, unknown> = { model: targetModel };

    if (body.max_tokens !== undefined) result.max_output_tokens = body.max_tokens;
    if (body.temperature !== undefined) result.temperature = body.temperature;
    if (body.top_p !== undefined) result.top_p = body.top_p;

    // System → instructions
    if (body.system) {
      result.instructions = typeof body.system === 'string'
        ? body.system
        : (body.system as Array<Record<string, unknown>>)
            .filter(b => b.type === 'text')
            .map(b => b.text)
            .join('\n');
    }

    // Messages → input
    const messages = body.messages as Array<Record<string, unknown>> || [];
    result.input = messages.map(msg => convertAnthropicMessageToResponsesInput(msg)).filter(Boolean);

    // Tools
    if (Array.isArray(body.tools) && (body.tools as unknown[]).length > 0) {
      result.tools = (body.tools as Array<Record<string, unknown>>).map(t => ({
        type: 'function' as const,
        name: t.name,
        description: t.description,
        parameters: t.input_schema,
      }));
      if (body.tool_choice) {
        result.tool_choice = convertAnthropicToolChoiceForResponses(body.tool_choice as Record<string, unknown>);
      }
    }

    // Thinking → reasoning
    if (body.thinking) {
      const thinking = body.thinking as Record<string, unknown>;
      if (thinking.type === 'enabled') {
        const budget = thinking.budget_tokens as number || 0;
        result.reasoning = {
          effort: budget <= 4000 ? 'low' : budget <= 16000 ? 'medium' : 'high',
          summary: 'auto',
        };
      }
    }

    // stop_sequences → (Responses doesn't have explicit field, handled via stopping)
    if (body.stop_sequences && Array.isArray(body.stop_sequences)) {
      // best-effort
    }

    return result;
  },

  convertResponse(body: Record<string, unknown>): Record<string, unknown> {
    if (body.error || body.status === 'failed') {
      return { type: 'error', error: { message: body.error || 'Request failed', type: 'api_error' } };
    }

    const output = body.output as Array<Record<string, unknown>> || [];
    const content: Record<string, unknown>[] = [];
    let stopReason = 'end_turn';

    for (const item of output) {
      if (item.type === 'message' && item.role === 'assistant') {
        const itemContent = item.content as Array<Record<string, unknown>> || [];
        for (const block of itemContent) {
          if (block.type === 'output_text') {
            content.push({ type: 'text', text: block.text });
          } else if (block.type === 'function_call') {
            content.push({
              type: 'tool_use',
              id: block.id || block.call_id,
              name: block.name,
              input: typeof block.arguments === 'string' ? safeJsonParse(block.arguments) : (block.arguments || {}),
            });
          } else if (block.type === 'reasoning') {
            content.push({
              type: 'thinking',
              thinking: block.summary || '',
              signature: '',
            });
          }
        }
      } else if (item.type === 'reasoning') {
        content.push({
          type: 'thinking',
          thinking: item.summary || '',
          signature: '',
        });
      }
    }

    // Determine stop reason
    if (body.status === 'completed') stopReason = 'end_turn';
    else if (body.status === 'incomplete' && body.incomplete_details) {
      const details = body.incomplete_details as Record<string, unknown>;
      if (details.reason === 'max_output_tokens') stopReason = 'max_tokens';
      else if (details.reason === 'content_filter') stopReason = 'end_turn';
    }

    const usage = body.usage as Record<string, number> || {};

    return {
      id: body.id || '',
      type: 'message',
      role: 'assistant',
      content,
      stop_reason: stopReason,
      usage: {
        input_tokens: usage.input_tokens || 0,
        output_tokens: usage.output_tokens || 0,
      },
      model: body.model || '',
    };
  },

  convertStreamChunk(rawLine: string): string | null {
    if (isDoneChunk(rawLine)) {
      return formatSSE('', '{"type":"response.completed","response":{"status":"completed","usage":{"input_tokens":0,"output_tokens":0,"total_tokens":0}}}');
    }

    const parsed = parseSSELine(rawLine);
    if (!parsed) return null;

    try {
      const event = JSON.parse(parsed.data);

      switch (event.type) {
        case 'response.created':
          return formatSSE('response.output_item.added', JSON.stringify({
            type: 'response.output_item.added',
            output_index: 0,
            item: {
              type: 'message',
              role: 'assistant',
              id: event.response?.id || '',
              content: [],
            },
          }));

        case 'response.output_item.added':
          return formatSSE('', rawLine);

        case 'content_block_start': {
          const block = event.content_block;
          if (block?.type === 'text') {
            return formatSSE('response.content_part.added', JSON.stringify({
              type: 'response.content_part.added',
              item_id: block.id || '',
              output_index: 0,
              content_index: event.index || 0,
              part: { type: 'output_text', text: '' },
            }));
          }
          if (block?.type === 'tool_use') {
            return formatSSE('response.output_item.added', JSON.stringify({
              type: 'response.output_item.added',
              output_index: 0,
              item: {
                type: 'function_call',
                id: block.id,
                name: block.name,
                call_id: block.id,
                arguments: '',
              },
            }));
          }
          return null;
        }

        case 'content_block_delta': {
          const delta = event.delta;
          if (delta?.type === 'text_delta') {
            return formatSSE('response.text.delta', JSON.stringify({
              type: 'response.text.delta',
              item_id: '',
              output_index: 0,
              content_index: 0,
              delta: delta.text,
            }));
          }
          if (delta?.type === 'input_json_delta') {
            return formatSSE('response.function_call_arguments.delta', JSON.stringify({
              type: 'response.function_call_arguments.delta',
              item_id: '',
              output_index: 0,
              delta: delta.partial_json,
            }));
          }
          return null;
        }

        case 'content_block_stop':
          return rawLine; // Forward as-is

        case 'message_delta': {
          const d = event.delta || {};
          const usage = event.usage;
          return formatSSE('response.output_item.done', JSON.stringify({
            type: 'response.output_item.done',
            output_index: 0,
            item: {
              status: 'completed',
              ...(usage ? { usage } : {}),
            },
          }));
        }

        case 'message_stop':
          return formatSSE('response.completed', JSON.stringify({
            type: 'response.completed',
            response: { status: 'completed' },
          }));

        default:
          return null;
      }
    } catch {
      return null;
    }
  },

  convertError(status: number, body: string): { status: number; body: string } {
    try {
      const parsed = JSON.parse(body);
      return {
        status,
        body: JSON.stringify({
          type: 'error',
          error: {
            type: parsed.type || 'api_error',
            message: parsed.error?.message || parsed.message || 'Unknown error',
          },
        }),
      };
    } catch {}
    return { status, body };
  },
});

export const ResponsesToAnthropicConverter: Converter = createConverter('openai-responses', 'anthropic', {
  convertRequest(body: Record<string, unknown>, targetModel: string): Record<string, unknown> {
    const result: Record<string, unknown> = { model: targetModel };

    if (body.max_output_tokens !== undefined) result.max_tokens = body.max_output_tokens;
    if (body.temperature !== undefined) result.temperature = body.temperature;
    if (body.top_p !== undefined) result.top_p = body.top_p;

    // instructions → system
    if (body.instructions) {
      result.system = [{ type: 'text', text: body.instructions }];
    }

    // input → messages
    const inputItems = body.input as Array<Record<string, unknown>> || [];
    result.messages = inputItems.map(item => convertResponsesInputToAnthropicMessage(item)).filter(Boolean);

    // Tools
    if (Array.isArray(body.tools) && (body.tools as unknown[]).length > 0) {
      result.tools = (body.tools as Array<Record<string, unknown>>).map(t => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters,
      }));
    }

    // reasoning → thinking
    if (body.reasoning) {
      const reasoning = body.reasoning as Record<string, unknown>;
      const budgetMap: Record<string, number> = { low: 2000, medium: 8000, high: 16000 };
      result.thinking = {
        type: 'enabled',
        budget_tokens: budgetMap[reasoning.effort as string] || 4000,
      };
    }

    return result;
  },

  convertResponse(body: Record<string, unknown>): Record<string, unknown> {
    if (body.error) return body;

    const content = body.content as Array<Record<string, unknown>> || [];
    const usage = body.usage as Record<string, number> || {};

    const output: Record<string, unknown>[] = [];
    const messageContent: Record<string, unknown>[] = [];

    for (const block of content) {
      if (block.type === 'text') {
        messageContent.push({ type: 'output_text', text: block.text, annotations: [] });
      } else if (block.type === 'tool_use') {
        messageContent.push({
          type: 'function_call',
          id: block.id,
          call_id: block.id,
          name: block.name,
          arguments: typeof block.input === 'object' ? JSON.stringify(block.input) : (block.input || ''),
        });
      } else if (block.type === 'thinking') {
        output.push({ type: 'reasoning', summary: [{ type: 'summary_text', text: block.thinking }] });
      }
    }

    if (messageContent.length > 0) {
      output.push({ type: 'message', role: 'assistant', content: messageContent });
    }

    return {
      id: body.id || '',
      object: 'response',
      model: body.model || '',
      status: 'completed',
      output,
      usage: {
        input_tokens: usage.input_tokens || 0,
        output_tokens: usage.output_tokens || 0,
        total_tokens: (usage.input_tokens || 0) + (usage.output_tokens || 0),
      },
    };
  },

  convertStreamChunk(rawLine: string): string | null {
    const parsed = parseSSELine(rawLine);
    if (!parsed) return null;

    try {
      const event = JSON.parse(parsed.data);

      switch (event.type) {
        case 'response.created':
          return formatSSE('', JSON.stringify({
            type: 'message_start',
            message: {
              id: event.response?.id || '',
              type: 'message',
              role: 'assistant',
              content: [],
              model: event.response?.model || '',
              usage: { input_tokens: 0, output_tokens: 0 },
            },
          }));

        case 'response.output_item.added': {
          const item = event.item;
          if (item?.type === 'message') {
            return formatSSE('', JSON.stringify({
              type: 'message_start',
              message: item,
            }));
          }
          if (item?.type === 'function_call') {
            return formatSSE('', JSON.stringify({
              type: 'content_block_start',
              index: event.output_index || 0,
              content_block: {
                type: 'tool_use',
                id: item.id || item.call_id,
                name: item.name,
                input: {},
              },
            }));
          }
          return null;
        }

        case 'response.content_part.added':
          return formatSSE('', JSON.stringify({
            type: 'content_block_start',
            index: event.content_index || 0,
            content_block: { type: 'text', text: '' },
          }));

        case 'response.text.delta':
          return formatSSE('', JSON.stringify({
            type: 'content_block_delta',
            index: 0,
            delta: { type: 'text_delta', text: event.delta },
          }));

        case 'response.function_call_arguments.delta':
          return formatSSE('', JSON.stringify({
            type: 'content_block_delta',
            index: 0,
            delta: { type: 'input_json_delta', partial_json: event.delta },
          }));

        case 'response.output_item.done':
          return formatSSE('', JSON.stringify({
            type: 'content_block_stop',
            index: event.output_index || 0,
          }));

        case 'response.completed': {
          const resp = event.response || {};
          const usage = resp.usage;
          return formatSSE('', JSON.stringify({
            type: 'message_delta',
            delta: { stop_reason: 'end_turn', stop_sequence: null },
            usage: usage ? {
              input_tokens: usage.input_tokens || 0,
              output_tokens: usage.output_tokens || 0,
            } : undefined,
          }));
        }

        default:
          return null;
      }
    } catch {
      return null;
    }
  },

  convertError(status: number, body: string): { status: number; body: string } {
    try {
      const parsed = JSON.parse(body);
      return {
        status,
        body: JSON.stringify({
          type: 'error',
          error: {
            type: parsed.type || 'api_error',
            message: parsed.error?.message || parsed.message || 'Unknown error',
          },
        }),
      };
    } catch {}
    return { status, body };
  },
});

// --- Helpers ---

function safeJsonParse(str: string): unknown {
  try { return JSON.parse(str); } catch { return {}; }
}

function convertAnthropicMessageToResponsesInput(msg: Record<string, unknown>): Record<string, unknown> | null {
  const role = msg.role as string;
  const content = msg.content as Array<Record<string, unknown>> || [];

  if (role === 'assistant') {
    const blocks = content.map(block => {
      if (block.type === 'text') return { type: 'output_text', text: block.text, annotations: [] };
      if (block.type === 'tool_use') return {
        type: 'function_call', id: block.id, call_id: block.id, name: block.name,
        arguments: typeof block.input === 'object' ? JSON.stringify(block.input) : (block.input || ''),
      };
      if (block.type === 'thinking') return { type: 'reasoning', summary: [{ type: 'summary_text', text: block.thinking }] };
      return null;
    }).filter(Boolean);
    return { role: 'assistant', content: blocks };
  }

  if (role === 'user') {
    const blocks = content.map(block => {
      if (block.type === 'text') return { type: 'input_text', text: block.text };
      if (block.type === 'tool_result') return { type: 'function_call_output', call_id: block.tool_use_id, output: block.content };
      if (block.type === 'image') return { type: 'input_image', image_url: block.source?.data ? `data:${block.source.media_type || 'image/jpeg'};base64,${block.source.data}` : block.source?.url || '' };
      return null;
    }).filter(Boolean);
    return { role: 'user', content: blocks };
  }

  return null;
}

function convertResponsesInputToAnthropicMessage(item: Record<string, unknown>): Record<string, unknown> | null {
  const role = item.role as string;
  const content = item.content as Array<Record<string, unknown>> || [];

  if (role === 'user') {
    const blocks = content.map(block => {
      if (block.type === 'input_text') return { type: 'text', text: block.text };
      if (block.type === 'function_call_output') return { type: 'tool_result', tool_use_id: block.call_id, content: block.output };
      if (block.type === 'input_image') {
        const url = (block.image_url as string) || '';
        const match = url.match(/^data:(image\/\w+);base64,(.+)$/);
        if (match) return { type: 'image', source: { type: 'base64', media_type: match[1], data: match[2] } };
        return { type: 'image', source: { type: 'url', url } };
      }
      return null;
    }).filter(Boolean);
    return { role: 'user', content: blocks };
  }

  if (role === 'assistant') {
    const blocks = content.map(block => {
      if (block.type === 'output_text') return { type: 'text', text: block.text };
      if (block.type === 'function_call') return {
        type: 'tool_use', id: block.id || block.call_id, name: block.name,
        input: typeof block.arguments === 'string' ? safeJsonParse(block.arguments) : (block.arguments || {}),
      };
      return null;
    }).filter(Boolean);
    return { role: 'assistant', content: blocks };
  }

  return null;
}

function convertAnthropicToolChoiceForResponses(tc: Record<string, unknown>): unknown {
  if (tc.type === 'auto') return 'auto';
  if (tc.type === 'any') return 'required';
  if (tc.type === 'tool' && tc.name) return { type: 'function', name: tc.name };
  return 'auto';
}
```

- [ ] **Step 4: Run tests to verify**

Run: `npx vitest run tests/converters/anthropic-responses.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: implement Anthropic ↔ OpenAI Responses converter"
```

---

### Task 6: OpenAI Chat ↔ OpenAI Responses Converter

**Files:**
- Create: `src/converters/openai-responses.ts`
- Create: `tests/converters/openai-responses.test.ts`

- [ ] **Step 1: Write test**

Create `tests/converters/openai-responses.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { OpenAIChatToResponsesConverter, ResponsesToOpenAIChatConverter } from '../../src/converters/openai-responses.js';

describe('OpenAIChatToResponsesConverter', () => {
  const conv = OpenAIChatToResponsesConverter;

  it('should convert basic messages to input format', () => {
    const input = {
      model: 'openai/gpt-4o',
      messages: [
        { role: 'system', content: 'Helpful assistant' },
        { role: 'user', content: 'Hello' },
      ],
      max_completion_tokens: 100,
    };
    const result = conv.convertRequest(input, 'gpt-4o');
    expect(result.model).toBe('gpt-4o');
    expect(result.instructions).toBe('Helpful assistant');
    expect(result.max_output_tokens).toBe(100);
    expect(result.input).toHaveLength(1);
    expect(result.input[0]).toEqual({ role: 'user', content: [{ type: 'input_text', text: 'Hello' }] });
  });

  it('should convert tool calls in assistant messages', () => {
    const input = {
      model: 'openai/gpt-4o',
      messages: [{
        role: 'assistant',
        content: 'Let me search.',
        tool_calls: [{
          id: 'call_1',
          type: 'function',
          function: { name: 'search', arguments: '{"q":"test"}' },
        }],
      }],
    };
    const result = conv.convertRequest(input, 'gpt-4o');
    expect(result.input[0].content).toHaveLength(2);
    expect(result.input[0].content[0]).toEqual({ type: 'output_text', text: 'Let me search.', annotations: [] });
    expect(result.input[0].content[1].type).toBe('function_call');
  });
});

describe('ResponsesToOpenAIChatConverter', () => {
  const conv = ResponsesToOpenAIChatConverter;

  it('should convert input to messages', () => {
    const input = {
      model: 'openai/gpt-4o',
      instructions: 'Helpful',
      input: [{ role: 'user', content: [{ type: 'input_text', text: 'Hi' }] }],
    };
    const result = conv.convertRequest(input, 'gpt-4o');
    expect(result.model).toBe('gpt-4o');
    expect(result.messages).toHaveLength(2);
    expect(result.messages[0]).toEqual({ role: 'system', content: 'Helpful' });
    expect(result.messages[1]).toEqual({ role: 'user', content: 'Hi' });
  });

  it('should convert function_call output', () => {
    const input = {
      model: 'openai/gpt-4o',
      input: [{
        role: 'assistant',
        content: [{ type: 'function_call', id: 'fc1', call_id: 'fc1', name: 'search', arguments: '{"q":"x"}' }],
      }],
    };
    const result = conv.convertRequest(input, 'gpt-4o');
    expect(result.messages[0].role).toBe('assistant');
    expect(result.messages[0].tool_calls).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/converters/openai-responses.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement converters**

Create `src/converters/openai-responses.ts`:
```typescript
import type { Converter } from '../types.js';
import { createConverter } from './base.js';
import { parseSSELine, formatSSE, isDoneChunk } from './helpers.js';

export const OpenAIChatToResponsesConverter: Converter = createConverter('openai', 'openai-responses', {
  convertRequest(body: Record<string, unknown>, targetModel: string): Record<string, unknown> {
    const result: Record<string, unknown> = { model: targetModel };

    if (body.max_completion_tokens !== undefined) result.max_output_tokens = body.max_completion_tokens;
    if (body.max_tokens !== undefined) result.max_output_tokens = body.max_tokens;
    if (body.temperature !== undefined) result.temperature = body.temperature;
    if (body.top_p !== undefined) result.top_p = body.top_p;

    const messages = body.messages as Array<Record<string, unknown>> || [];

    // Extract system message
    const systemMsg = messages.find(m => m.role === 'system');
    if (systemMsg) {
      result.instructions = systemMsg.content;
    }

    // Convert remaining messages to input
    result.input = messages
      .filter(m => m.role !== 'system')
      .map(msg => convertOAItoResponsesInput(msg))
      .filter(Boolean);

    // Tools
    if (Array.isArray(body.tools) && (body.tools as unknown[]).length > 0) {
      result.tools = (body.tools as Array<Record<string, unknown>>).map(t => {
        const fn = t.function as Record<string, unknown> || {};
        return { type: 'function', name: fn.name, description: fn.description, parameters: fn.parameters };
      });
    }

    // reasoning_effort → reasoning
    if (body.reasoning_effort) {
      result.reasoning = { effort: body.reasoning_effort, summary: 'auto' };
    }

    // stop → stop is not directly supported in Responses, best-effort
    if (body.stop) {
      // Passed through; Responses handles this differently
    }

    return result;
  },

  convertResponse(body: Record<string, unknown>): Record<string, unknown> {
    if (body.error) return body;

    const output = body.output as Array<Record<string, unknown>> || [];
    const choices: Record<string, unknown>[] = [];
    let message: Record<string, unknown> = { role: 'assistant', content: '' };
    let finishReason = 'stop';

    for (const item of output) {
      if (item.type === 'message' && item.role === 'assistant') {
        const itemContent = item.content as Array<Record<string, unknown>> || [];
        const texts: string[] = [];
        const toolCalls: Record<string, unknown>[] = [];

        for (const block of itemContent) {
          if (block.type === 'output_text') {
            texts.push(block.text as string);
          } else if (block.type === 'function_call') {
            toolCalls.push({
              id: block.id || block.call_id,
              type: 'function',
              function: {
                name: block.name,
                arguments: typeof block.arguments === 'string' ? block.arguments : JSON.stringify(block.arguments || {}),
              },
            });
          }
        }

        message.content = texts.join('\n') || null;
        if (toolCalls.length > 0) {
          message.tool_calls = toolCalls;
          if (!message.content) message.content = null;
          finishReason = 'tool_calls';
        }
      }
    }

    const usage = body.usage as Record<string, number> || {};

    choices.push({ index: 0, message, finish_reason: finishReason });

    return {
      id: body.id || '',
      object: 'chat.completion',
      model: body.model || '',
      created: Math.floor(Date.now() / 1000),
      choices,
      usage: {
        prompt_tokens: usage.input_tokens || 0,
        completion_tokens: usage.output_tokens || 0,
        total_tokens: (usage.input_tokens || 0) + (usage.output_tokens || 0),
      },
    };
  },

  convertStreamChunk(rawLine: string): string | null {
    const parsed = parseSSELine(rawLine);
    if (!parsed) return null;

    try {
      const chunk = JSON.parse(parsed.data);
      const choice = chunk.choices?.[0];
      const delta = choice?.delta;

      if (!delta) {
        if (choice?.finish_reason || chunk.usage) {
          return formatSSE('response.completed', JSON.stringify({
            type: 'response.completed',
            response: {
              status: 'completed',
              usage: chunk.usage ? {
                input_tokens: chunk.usage.prompt_tokens || 0,
                output_tokens: chunk.usage.completion_tokens || 0,
                total_tokens: chunk.usage.total_tokens || 0,
              } : undefined,
            },
          }));
        }
        return null;
      }

      if (delta.content) {
        return formatSSE('response.text.delta', JSON.stringify({
          type: 'response.text.delta',
          item_id: '',
          output_index: 0,
          content_index: 0,
          delta: delta.content,
        }));
      }

      if (delta.tool_calls) {
        const tc = delta.tool_calls[0];
        if (tc?.function?.name) {
          return formatSSE('response.output_item.added', JSON.stringify({
            type: 'response.output_item.added',
            output_index: 0,
            item: { type: 'function_call', id: tc.id || tc.index?.toString() || '', name: tc.function.name, call_id: tc.id || '', arguments: '' },
          }));
        }
        if (tc?.function?.arguments) {
          return formatSSE('response.function_call_arguments.delta', JSON.stringify({
            type: 'response.function_call_arguments.delta',
            item_id: '',
            output_index: 0,
            delta: tc.function.arguments,
          }));
        }
      }

      return null;
    } catch {
      return null;
    }
  },

  convertError(status: number, body: string): { status: number; body: string } {
    return { status, body };
  },
});

export const ResponsesToOpenAIChatConverter: Converter = createConverter('openai-responses', 'openai', {
  convertRequest(body: Record<string, unknown>, targetModel: string): Record<string, unknown> {
    const result: Record<string, unknown> = { model: targetModel };

    if (body.max_output_tokens !== undefined) result.max_completion_tokens = body.max_output_tokens;
    if (body.temperature !== undefined) result.temperature = body.temperature;
    if (body.top_p !== undefined) result.top_p = body.top_p;

    const messages: Record<string, unknown>[] = [];

    if (body.instructions) {
      messages.push({ role: 'system', content: body.instructions });
    }

    const input = body.input as Array<Record<string, unknown>> || [];
    for (const item of input) {
      const converted = convertResponsesInputToOAI(item);
      if (converted) messages.push(converted);
    }

    result.messages = messages;

    if (Array.isArray(body.tools) && (body.tools as unknown[]).length > 0) {
      result.tools = (body.tools as Array<Record<string, unknown>>).map(t => ({
        type: 'function',
        function: { name: t.name, description: t.description, parameters: t.parameters },
      }));
    }

    if (body.reasoning) {
      result.reasoning_effort = (body.reasoning as Record<string, unknown>).effort || 'medium';
    }

    return result;
  },

  convertResponse(body: Record<string, unknown>): Record<string, unknown> {
    const choice = (body.choices as Array<Record<string, unknown>>)?.[0] || {};
    const message = choice.message as Record<string, unknown> || {};
    const usage = body.usage as Record<string, number> || {};

    const output: Record<string, unknown>[] = [];
    const msgContent: Record<string, unknown>[] = [];

    if (message.content) {
      msgContent.push({ type: 'output_text', text: message.content, annotations: [] });
    }

    if (Array.isArray(message.tool_calls)) {
      for (const tc of message.tool_calls as Array<Record<string, unknown>>) {
        const fn = tc.function as Record<string, unknown>;
        msgContent.push({
          type: 'function_call',
          id: tc.id,
          call_id: tc.id,
          name: fn?.name,
          arguments: fn?.arguments,
        });
      }
    }

    if (msgContent.length > 0) {
      output.push({ type: 'message', role: 'assistant', content: msgContent });
    }

    return {
      id: body.id || '',
      object: 'response',
      model: body.model || '',
      created_at: body.created,
      status: 'completed',
      output,
      usage: {
        input_tokens: usage.prompt_tokens || 0,
        output_tokens: usage.completion_tokens || 0,
        total_tokens: usage.total_tokens || 0,
      },
    };
  },

  convertStreamChunk(rawLine: string): string | null {
    const parsed = parseSSELine(rawLine);
    if (!parsed) return null;

    try {
      const event = JSON.parse(parsed.data);

      switch (event.type) {
        case 'response.created':
          return formatSSE('', JSON.stringify({
            choices: [{ delta: { role: 'assistant' }, index: 0 }],
          }));

        case 'response.output_item.added': {
          const item = event.item;
          if (item?.type === 'message') return null; // handled by role event
          if (item?.type === 'function_call') {
            return formatSSE('', JSON.stringify({
              choices: [{ delta: { tool_calls: [{ index: 0, id: item.id || item.call_id, type: 'function', function: { name: item.name, arguments: '' } }] }, index: 0 }],
            }));
          }
          return null;
        }

        case 'response.text.delta':
          return formatSSE('', JSON.stringify({
            choices: [{ delta: { content: event.delta }, index: 0 }],
          }));

        case 'response.function_call_arguments.delta':
          return formatSSE('', JSON.stringify({
            choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: event.delta } }] }, index: 0 }],
          }));

        case 'response.completed': {
          const resp = event.response || {};
          const usage = resp.usage;
          return formatSSE('', JSON.stringify({
            choices: [{ finish_reason: 'stop', index: 0 }],
            usage: usage ? {
              prompt_tokens: usage.input_tokens || 0,
              completion_tokens: usage.output_tokens || 0,
              total_tokens: (usage.input_tokens || 0) + (usage.output_tokens || 0),
            } : undefined,
          }));
        }

        default:
          return null;
      }
    } catch {
      return null;
    }
  },

  convertError(status: number, body: string): { status: number; body: string } {
    return { status, body };
  },
});

// --- Helpers ---

function convertOAItoResponsesInput(msg: Record<string, unknown>): Record<string, unknown> | null {
  const role = msg.role as string;

  if (role === 'user') {
    const content = msg.content;
    if (typeof content === 'string') {
      return { role: 'user', content: [{ type: 'input_text', text: content }] };
    }
    if (Array.isArray(content)) {
      const blocks = (content as Array<Record<string, unknown>>).map(c => {
        if (c.type === 'text') return { type: 'input_text', text: c.text };
        if (c.type === 'image_url') {
          return { type: 'input_image', image_url: (c.image_url as Record<string, string>)?.url || '' };
        }
        return null;
      }).filter(Boolean);
      return { role: 'user', content: blocks };
    }
  }

  if (role === 'assistant') {
    const blocks: Record<string, unknown>[] = [];
    if (msg.content && msg.content !== '') {
      blocks.push({ type: 'output_text', text: msg.content, annotations: [] });
    }
    if (Array.isArray(msg.tool_calls)) {
      for (const tc of msg.tool_calls as Array<Record<string, unknown>>) {
        const fn = tc.function as Record<string, unknown>;
        blocks.push({ type: 'function_call', id: tc.id, call_id: tc.id, name: fn?.name, arguments: fn?.arguments });
      }
    }
    return { role: 'assistant', content: blocks };
  }

  if (role === 'tool') {
    return {
      role: 'user',
      content: [{ type: 'function_call_output', call_id: msg.tool_call_id, output: msg.content }],
    };
  }

  return null;
}

function convertResponsesInputToOAI(item: Record<string, unknown>): Record<string, unknown> | null {
  const role = item.role as string;
  const content = item.content as Array<Record<string, unknown>> || [];

  if (role === 'user') {
    const texts: string[] = [];
    const images: Record<string, unknown>[] = [];
    const toolResults: Record<string, unknown>[] = [];

    for (const block of content) {
      if (block.type === 'input_text') texts.push(block.text as string);
      else if (block.type === 'input_image') images.push({ type: 'image_url', image_url: { url: block.image_url } });
      else if (block.type === 'function_call_output') toolResults.push(block);
    }

    if (texts.length === 1 && images.length === 0 && toolResults.length === 0) {
      return { role: 'user', content: texts[0] };
    }
    // Array content
    const parts: Record<string, unknown>[] = [
      ...texts.map(t => ({ type: 'text', text: t })),
      ...images,
    ];
    if (parts.length > 0) return { role: 'user', content: parts };

    // Tool result messages
    if (toolResults.length > 0) {
      return { role: 'tool', tool_call_id: toolResults[0].call_id, content: toolResults[0].output };
    }

    return null;
  }

  if (role === 'assistant') {
    const result: Record<string, unknown> = { role: 'assistant' };
    const texts: string[] = [];
    const toolCalls: Record<string, unknown>[] = [];

    for (const block of content) {
      if (block.type === 'output_text') texts.push(block.text as string);
      else if (block.type === 'function_call') {
        toolCalls.push({
          id: block.id || block.call_id,
          type: 'function',
          function: { name: block.name, arguments: typeof block.arguments === 'string' ? block.arguments : JSON.stringify(block.arguments || {}) },
        });
      }
    }

    result.content = texts.join('\n') || null;
    if (toolCalls.length > 0) result.tool_calls = toolCalls;
    return result;
  }

  return null;
}
```

- [ ] **Step 4: Run tests to verify**

Run: `npx vitest run tests/converters/openai-responses.test.ts`
Expected: PASS

- [ ] **Step 5: Register all converters**

Update `src/converters/registry.ts` initialization — create `src/converters/index.ts`:
```typescript
import { ConverterRegistry } from './registry.js';
import { AnthropicToOpenAIChatConverter, OpenAIChatToAnthropicConverter } from './anthropic-openai.js';
import { AnthropicToResponsesConverter, ResponsesToAnthropicConverter } from './anthropic-responses.js';
import { OpenAIChatToResponsesConverter, ResponsesToOpenAIChatConverter } from './openai-responses.js';

export function registerAllConverters(): void {
  ConverterRegistry.register(AnthropicToOpenAIChatConverter);
  ConverterRegistry.register(OpenAIChatToAnthropicConverter);
  ConverterRegistry.register(AnthropicToResponsesConverter);
  ConverterRegistry.register(ResponsesToAnthropicConverter);
  ConverterRegistry.register(OpenAIChatToResponsesConverter);
  ConverterRegistry.register(ResponsesToOpenAIChatConverter);
}

export { ConverterRegistry } from './registry.js';
```

- [ ] **Step 6: Verify all converter tests pass**

Run: `npx vitest run tests/converters/`
Expected: All PASS

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: implement OpenAI Chat ↔ OpenAI Responses converter"
```

---

### Task 7: Proxy Engine — Router + Forwarder + Stream Handler

**Files:**
- Create: `src/proxy/router.ts`
- Create: `src/proxy/forwarder.ts`
- Create: `src/proxy/stream-handler.ts`
- Create: `tests/proxy/router.test.ts`

- [ ] **Step 1: Write router test**

Create `tests/proxy/router.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { resolveRoute } from '../../src/proxy/router.js';
import type { AppConfig } from '../../src/types.js';
import { defaults } from '../../src/config/defaults.js';

const testConfig: AppConfig = {
  ...defaults,
  providers: {
    openai: {
      display_name: 'OpenAI',
      base_url: 'https://api.openai.com/v1',
      api_key: 'sk-test',
      protocol: 'openai',
      models: ['gpt-4o', 'gpt-5'],
    },
    anthropic: {
      display_name: 'Anthropic',
      base_url: 'https://api.anthropic.com',
      api_key: 'sk-ant-test',
      protocol: 'anthropic',
      models: ['claude-sonnet-4-20250514'],
    },
    deepseek: {
      display_name: 'DeepSeek',
      base_url: 'https://api.deepseek.com',
      api_key: 'sk-ds-test',
      protocol: 'openai',
      models: ['deepseek-chat'],
    },
  },
};

describe('resolveRoute', () => {
  it('should parse provider/model and resolve config', () => {
    const route = resolveRoute(testConfig, 'openai/gpt-4o', '/v1/chat/completions', true);
    expect(route).not.toBeNull();
    expect(route!.providerKey).toBe('openai');
    expect(route!.model).toBe('gpt-4o');
    expect(route!.sourceProtocol).toBe('openai-chat');
    expect(route!.targetProtocol).toBe('openai');
    expect(route!.stream).toBe(true);
  });

  it('should resolve same protocol as pass-through', () => {
    const route = resolveRoute(testConfig, 'deepseek/deepseek-chat', '/v1/chat/completions', false);
    expect(route!.sourceProtocol).toBe('openai-chat');
    expect(route!.targetProtocol).toBe('openai');
  });

  it('should detect Anthropic source from /v1/messages', () => {
    const route = resolveRoute(testConfig, 'openai/gpt-4o', '/v1/messages', false);
    expect(route!.sourceProtocol).toBe('anthropic');
    expect(route!.targetProtocol).toBe('openai');
  });

  it('should throw on unknown provider', () => {
    expect(() => resolveRoute(testConfig, 'unknown/model', '/v1/chat/completions', false))
      .toThrow(/provider.*not found/i);
  });

  it('should throw when model not in provider model list', () => {
    expect(() => resolveRoute(testConfig, 'openai/unknown-model', '/v1/chat/completions', false))
      .toThrow(/model.*not found/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/proxy/router.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement router**

Create `src/proxy/router.ts`:
```typescript
import type { AppConfig, RouteInfo, ProviderProtocol } from '../types.js';

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

export function normalizeTargetProtocol(p: ProviderProtocol): string {
  if (p === 'openai-responses') return 'openai-responses';
  return p; // 'openai' | 'anthropic' | 'gemini'
}
```

- [ ] **Step 4: Implement forwarder**

Create `src/proxy/forwarder.ts`:
```typescript
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

  // Build URL based on target protocol
  let url = provider.base_url.replace(/\/+$/, '');

  if (route.targetProtocol === 'openai') {
    url = url + '/chat/completions';
  } else if (route.targetProtocol === 'openai-responses') {
    url = url + '/responses';
  } else if (route.targetProtocol === 'anthropic') {
    url = url + '/messages';
  }
  // For gemini and other protocols, URL is provider's base_url as-is (or append accordingly)

  // Build headers
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
  } else {
    headers['Authorization'] = `Bearer ${provider.api_key}`;
  }

  // Anthropic also requires anthropic-version header
  if (route.targetProtocol === 'anthropic') {
    headers['anthropic-version'] = '2023-06-01';
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
```

- [ ] **Step 5: Implement stream handler**

Create `src/proxy/stream-handler.ts`:
```typescript
import type { FastifyReply } from 'fastify';
import type { Converter, RouteInfo } from '../types.js';
import { ConverterRegistry } from '../converters/registry.js';
import { pipeline, Readable, Transform, TransformCallback } from 'stream';

export async function proxyStreamToClient(
  upstreamResponse: Response,
  route: RouteInfo,
  reply: FastifyReply,
): Promise<void> {
  const converter = ConverterRegistry.get(route.sourceProtocol, route.targetProtocol);

  reply.raw.writeHead(upstreamResponse.status, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  if (!upstreamResponse.body) {
    reply.raw.end();
    return;
  }

  const reader = upstreamResponse.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // keep incomplete line in buffer

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) {
          reply.raw.write('\n');
          continue;
        }

        const converted = converter
          ? converter.convertStreamChunk(trimmed)
          : trimmed;

        if (converted !== null) {
          reply.raw.write(converted + '\n\n');
        }
      }
    }

    // Flush remaining buffer
    if (buffer.trim()) {
      const converted = converter
        ? converter.convertStreamChunk(buffer.trim())
        : buffer.trim();
      if (converted !== null) {
        reply.raw.write(converted + '\n\n');
      }
    }
  } catch (err) {
    const errMsg = (err as Error).message;
    const errorChunk = converter
      ? converter.convertError(500, JSON.stringify({ error: { message: errMsg } }))
      : { status: 500, body: JSON.stringify({ error: { message: errMsg } }) };
    reply.raw.write(`data: ${errorChunk.body}\n\n`);
  } finally {
    reader.releaseLock();
    reply.raw.end();
  }
}
```

- [ ] **Step 6: Run tests**

Run: `npx vitest run tests/proxy/router.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: implement proxy router, forwarder, and stream handler"
```

---

### Task 8: Fastify Server + API Routes

**Files:**
- Create: `src/server/app.ts`
- Create: `src/server/middleware/logger.ts`
- Create: `src/server/routes/proxy.ts`
- Create: `src/server/routes/models.ts`
- Create: `src/server/routes/config.ts`
- Create: `src/server/routes/providers.ts`
- Create: `src/server/routes/health.ts`
- Create: `src/server/routes/logs.ts`
- Create: `src/server/routes/update.ts`
- Modify: `src/index.ts`

- [ ] **Step 1: Create Fastify app**

Create `src/server/app.ts`:
```typescript
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyCors from '@fastify/cors';
import path from 'path';
import { existsSync } from 'fs';
import type { AppConfig } from '../types.js';
import { registerProxyRoutes } from './routes/proxy.js';
import { registerModelsRoutes } from './routes/models.js';
import { registerConfigRoutes } from './routes/config.js';
import { registerProviderRoutes } from './routes/providers.js';
import { registerHealthRoute } from './routes/health.js';
import { registerLogsRoutes } from './routes/logs.js';
import { registerUpdateRoutes } from './routes/update.js';

export async function createApp(config: AppConfig): Promise<ReturnType<typeof Fastify>> {
  const app = Fastify({
    logger: {
      level: config.logging.level,
      ...(config.logging.dir !== 'logs' || config.logging.level === 'debug'
        ? { transport: { target: 'pino/file', options: { destination: 1 } } }
        : {}),
    },
    bodyLimit: 10 * 1024 * 1024, // 10MB for image payloads
  });

  // CORS
  if (config.server.cors) {
    await app.register(fastifyCors, { origin: true });
  }

  // Request logging middleware
  app.addHook('onRequest', async (request) => {
    if (request.url.startsWith('/api/')) {
      request.log.info({ url: request.url, method: request.method }, 'API request');
    }
  });

  // Error handler
  app.setErrorHandler((error, request, reply) => {
    request.log.error({ err: error }, 'Unhandled error');
    reply.status(error.statusCode || 500).send({
      error: { message: error.message, type: 'server_error' },
    });
  });

  // Register routes
  registerProxyRoutes(app, config);
  registerModelsRoutes(app, config);
  registerConfigRoutes(app, config);
  registerProviderRoutes(app, config);
  registerHealthRoute(app);
  registerLogsRoutes(app);
  registerUpdateRoutes(app);

  // Serve static UI files
  const uiDistPath = path.resolve(process.cwd(), 'dist/ui');
  if (existsSync(uiDistPath)) {
    await app.register(fastifyStatic, {
      root: uiDistPath,
      prefix: '/',
      wildcard: false,
    });

    // SPA fallback
    app.setNotFoundHandler((request, reply) => {
      if (!request.url.startsWith('/v1/') && !request.url.startsWith('/api/')) {
        return reply.sendFile('index.html');
      }
      reply.status(404).send({ error: { message: 'Not found' } });
    });
  }

  return app;
}
```

- [ ] **Step 2: Create logger middleware**

Create `src/server/middleware/logger.ts`:
```typescript
import type { FastifyRequest, FastifyReply } from 'fastify';

export interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  provider?: string;
  model?: string;
  message: string;
  duration?: number;
}

export const logBuffer: LogEntry[] = [];
const MAX_BUFFER = 1000;

export function addLog(entry: LogEntry): void {
  logBuffer.push(entry);
  if (logBuffer.length > MAX_BUFFER) {
    logBuffer.shift();
  }
}

export async function requestLogger(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const start = Date.now();

  _reply.then(() => {
    const duration = Date.now() - start;
    addLog({
      timestamp: new Date().toISOString(),
      level: 'info',
      message: `${request.method} ${request.url} - ${_reply.statusCode} (${duration}ms)`,
    });
  });
}
```

- [ ] **Step 3: Create proxy route**

Create `src/server/routes/proxy.ts`:
```typescript
import type { FastifyInstance } from 'fastify';
import type { AppConfig } from '../../types.js';
import { resolveRoute, normalizeTargetProtocol } from '../../proxy/router.js';
import { buildUpstreamRequest, preserveResponseHeaders } from '../../proxy/forwarder.js';
import { proxyStreamToClient } from '../../proxy/stream-handler.js';
import { ConverterRegistry } from '../../converters/index.js';

export function registerProxyRoutes(app: FastifyInstance, config: AppConfig): void {
  async function handleProxy(request: any, reply: any): Promise<void> {
    try {
      const body = request.body as Record<string, unknown>;
      const modelField = body.model as string;
      const stream = body.stream === true;
      const endpointPath = request.url.split('?')[0];

      const route = resolveRoute(config, modelField, endpointPath, stream);

      // Apply conversion if needed
      let bodyToSend = body;
      if (ConverterRegistry.needsConversion(route.sourceProtocol, route.targetProtocol)) {
        const converter = ConverterRegistry.get(route.sourceProtocol, route.targetProtocol);
        if (converter) {
          bodyToSend = converter.convertRequest(body, route.model);
        }
      } else {
        // Pass-through: strip provider/ prefix from model
        bodyToSend = { ...body, model: route.model };
      }

      // Build upstream request
      const headers: Record<string, string> = {};
      for (const [k, v] of Object.entries(request.headers)) {
        if (typeof v === 'string') headers[k] = v;
      }

      const upstream = buildUpstreamRequest(route, bodyToSend, headers, config);

      // Send to upstream
      const response = await fetch(upstream.url, {
        method: upstream.method,
        headers: upstream.headers,
        body: upstream.body,
        signal: AbortSignal.timeout(config.proxy.timeout),
      });

      if (!response.ok) {
        const errText = await response.text();
        const converter = ConverterRegistry.get(route.sourceProtocol as any, route.targetProtocol);
        const mapped = converter
          ? converter.convertError(response.status, errText)
          : { status: response.status, body: errText };

        const respHeaders: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        Object.assign(respHeaders, preserveResponseHeaders(
          Object.fromEntries(response.headers.entries()),
          config,
        ));

        reply.status(mapped.status).headers(respHeaders).send(JSON.parse(mapped.body));
        return;
      }

      if (stream) {
        await proxyStreamToClient(response, route, reply);
        return;
      }

      // Non-streaming response
      const rawBody = await response.text();
      let responseBody = JSON.parse(rawBody);

      // Convert response back
      if (ConverterRegistry.needsConversion(route.sourceProtocol, route.targetProtocol)) {
        const converter = ConverterRegistry.get(route.sourceProtocol, route.targetProtocol);
        if (converter) {
          responseBody = converter.convertResponse(responseBody);
        }
      }

      const respHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      Object.assign(respHeaders, preserveResponseHeaders(
        Object.fromEntries(response.headers.entries()),
        config,
      ));

      reply.headers(respHeaders).send(responseBody);
    } catch (err) {
      const message = (err as Error).message;
      const status = message.includes('not found') ? 404 : message.includes('Invalid') ? 400 : 502;
      reply.status(status).send({ error: { message, type: 'proxy_error' } });
    }
  }

  app.post('/v1/chat/completions', handleProxy);
  app.post('/v1/messages', handleProxy);
  app.post('/v1/responses', handleProxy);
}
```

- [ ] **Step 4: Create remaining routes**

Create `src/server/routes/models.ts`:
```typescript
import type { FastifyInstance } from 'fastify';
import type { AppConfig } from '../../types.js';

export function registerModelsRoutes(app: FastifyInstance, config: AppConfig): void {
  app.get('/v1/models', async (_request, reply) => {
    const data: Array<{ id: string; object: string; owned_by: string }> = [];

    for (const [key, provider] of Object.entries(config.providers)) {
      for (const model of provider.models) {
        data.push({ id: `${key}/${model}`, object: 'model', owned_by: key });
      }
    }

    reply.send({ object: 'list', data });
  });
}
```

Create `src/server/routes/config.ts`:
```typescript
import type { FastifyInstance } from 'fastify';
import type { AppConfig } from '../../types.js';
import { writeConfig } from '../../config/writer.js';
import path from 'path';

const CONFIG_PATH = process.env.CONFIG_PATH || path.resolve(process.cwd(), 'config.yaml');

export function registerConfigRoutes(app: FastifyInstance, config: AppConfig): void {
  app.get('/api/config', async (_request, reply) => {
    reply.send(config);
  });

  app.put('/api/config', async (request, reply) => {
    const newConfig = request.body as AppConfig;
    writeConfig(CONFIG_PATH, newConfig);
    // Update in-memory config
    Object.assign(config, newConfig);
    reply.send({ ok: true });
  });
}
```

Create `src/server/routes/providers.ts`:
```typescript
import type { FastifyInstance } from 'fastify';
import type { AppConfig, ProviderConfig } from '../../types.js';
import { writeConfig } from '../../config/writer.js';
import path from 'path';

const CONFIG_PATH = process.env.CONFIG_PATH || path.resolve(process.cwd(), 'config.yaml');

export function registerProviderRoutes(app: FastifyInstance, config: AppConfig): void {
  app.get('/api/providers', async (_request, reply) => {
    reply.send(config.providers);
  });

  app.post('/api/providers', async (request, reply) => {
    const { key, ...providerData } = request.body as { key: string } & ProviderConfig;
    if (!key) {
      return reply.status(400).send({ error: { message: 'Provider key is required' } });
    }
    if (config.providers[key]) {
      return reply.status(409).send({ error: { message: `Provider "${key}" already exists` } });
    }
    config.providers[key] = providerData;
    writeConfig(CONFIG_PATH, config);
    reply.status(201).send({ ok: true, key });
  });

  app.put('/api/providers/:key', async (request, reply) => {
    const { key } = request.params as { key: string };
    const providerData = request.body as ProviderConfig;
    if (!config.providers[key]) {
      return reply.status(404).send({ error: { message: `Provider "${key}" not found` } });
    }
    config.providers[key] = providerData;
    writeConfig(CONFIG_PATH, config);
    reply.send({ ok: true });
  });

  app.delete('/api/providers/:key', async (request, reply) => {
    const { key } = request.params as { key: string };
    if (!config.providers[key]) {
      return reply.status(404).send({ error: { message: `Provider "${key}" not found` } });
    }
    delete config.providers[key];
    writeConfig(CONFIG_PATH, config);
    reply.send({ ok: true });
  });
}
```

Create `src/server/routes/health.ts`:
```typescript
import type { FastifyInstance } from 'fastify';

export function registerHealthRoute(app: FastifyInstance): void {
  app.get('/api/health', async (_request, reply) => {
    reply.send({ status: 'ok', uptime: process.uptime() });
  });
}
```

Create `src/server/routes/logs.ts`:
```typescript
import type { FastifyInstance } from 'fastify';
import { logBuffer } from '../middleware/logger.js';

export function registerLogsRoutes(app: FastifyInstance): void {
  app.get('/api/logs', async (_request, reply) => {
    reply.send(logBuffer.slice(-200)); // last 200 entries
  });

  app.get('/api/logs/stream', async (_request, reply) => {
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    // Send existing logs first
    for (const entry of logBuffer.slice(-50)) {
      reply.raw.write(`data: ${JSON.stringify(entry)}\n\n`);
    }

    // Send a heartbeat every 30s
    const interval = setInterval(() => {
      reply.raw.write(`data: ${JSON.stringify({ type: 'heartbeat' })}\n\n`);
    }, 30000);

    request.raw.on('close', () => {
      clearInterval(interval);
      reply.raw.end();
    });
  });
}
```

Create `src/server/routes/update.ts`:
```typescript
import type { FastifyInstance } from 'fastify';
import { getLatestVersion } from '../../update/checker.js';

export function registerUpdateRoutes(app: FastifyInstance): void {
  app.get('/api/update/check', async (_request, reply) => {
    try {
      const pkg = await import('../../../package.json', { assert: { type: 'json' } });
      const currentVersion = pkg.default.version;
      const latest = await getLatestVersion();
      reply.send({
        current: currentVersion,
        latest: latest,
        hasUpdate: latest !== null && latest !== currentVersion,
      });
    } catch (err) {
      reply.status(500).send({ error: { message: (err as Error).message } });
    }
  });

  app.post('/api/update/execute', async (_request, reply) => {
    try {
      reply.send({ ok: true, message: 'Update triggered. Server will restart.' });
      // Trigger update in background
      setTimeout(() => {
        const { execUpdate } = require('../../update/executor.js');
        execUpdate().catch(console.error);
      }, 1000);
    } catch (err) {
      reply.status(500).send({ error: { message: (err as Error).message } });
    }
  });
}
```

- [ ] **Step 5: Update entry point**

Modify `src/index.ts`:
```typescript
import { loadConfig } from './config/loader.js';
import { createApp } from './server/app.js';
import { registerAllConverters } from './converters/index.js';
import { runMigrations } from './migrations/registry.js';
import { checkForUpdate } from './update/checker.js';
import path from 'path';

const CONFIG_PATH = process.env.CONFIG_PATH || path.resolve(process.cwd(), 'config.yaml');

async function main(): Promise<void> {
  console.log('open-api-proxy v0.1.0 starting...');

  // Run config migrations
  await runMigrations(CONFIG_PATH);

  // Load configuration
  const config = loadConfig(CONFIG_PATH);
  console.log(`Loaded ${Object.keys(config.providers).length} providers`);

  // Register all protocol converters
  registerAllConverters();
  console.log('Protocol converters registered');

  // Create Fastify app
  const app = await createApp(config);

  // Start server
  const { port, host } = config.server;
  await app.listen({ port, host });
  console.log(`open-api-proxy running at http://${host}:${port}`);

  // Check for updates asynchronously
  checkForUpdate().then((latest) => {
    if (latest) {
      console.log(`Update available: ${latest}`);
    }
  }).catch(() => {});
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
```

- [ ] **Step 6: Verify compilation**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: implement Fastify server and all API routes"
```

---

### Task 9: Migration System + Update Checker

**Files:**
- Create: `src/migrations/registry.ts`
- Create: `src/migrations/v0_to_v1.ts`
- Create: `src/update/checker.ts`
- Create: `src/update/executor.ts`

- [ ] **Step 1: Implement migration system**

Create `src/migrations/v0_to_v1.ts`:
```typescript
import type { AppConfig } from '../types.js';

export function v0ToV1(config: Record<string, unknown>): AppConfig {
  // Add _schema_version field
  const result = { _schema_version: 1, ...config } as unknown as AppConfig;

  // Ensure required top-level keys exist
  result.providers = result.providers || {};

  return result;
}
```

Create `src/migrations/registry.ts`:
```typescript
import { readFileSync, writeFileSync, existsSync } from 'fs';
import * as yaml from 'js-yaml';
import { v0ToV1 } from './v0_to_v1.js';

const MIGRATIONS: Array<{ from: number; to: number; migrate: (config: Record<string, unknown>) => Record<string, unknown> }> = [
  { from: 0, to: 1, migrate: v0ToV1 },
  // Add more migrations here as schema evolves
];

const CURRENT_SCHEMA_VERSION = 1;

export async function runMigrations(configPath: string): Promise<void> {
  if (!existsSync(configPath)) return; // No config file, nothing to migrate

  const raw = readFileSync(configPath, 'utf8');
  let config = yaml.load(raw) as Record<string, unknown> || {};

  const currentVersion = (config._schema_version as number) || 0;

  if (currentVersion >= CURRENT_SCHEMA_VERSION) return;

  console.log(`Running config migrations: v${currentVersion} → v${CURRENT_SCHEMA_VERSION}`);

  // Find applicable migrations in order
  let version = currentVersion;
  for (const migration of MIGRATIONS) {
    if (migration.from === version) {
      config = migration.migrate(config);
      config._schema_version = migration.to;
      version = migration.to;
    }
  }

  // Write back merged config
  writeFileSync(configPath, yaml.dump(config, { indent: 2, lineWidth: 120 }), 'utf8');
  console.log(`Config migration complete. Schema version: ${config._schema_version}`);
}
```

- [ ] **Step 2: Implement update checker**

Create `src/update/checker.ts`:
```typescript
import { readFileSync } from 'fs';
import path from 'path';

let cachedVersion: string | null = null;

export function getCurrentVersion(): string {
  if (cachedVersion) return cachedVersion;

  try {
    const pkgPath = path.resolve(process.cwd(), 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    cachedVersion = pkg.version;
    return cachedVersion;
  } catch {
    return '0.0.0';
  }
}

export async function getLatestVersion(): Promise<string | null> {
  try {
    const response = await fetch(
      'https://api.github.com/repos/leenixp/open-api-proxy/releases/latest',
      {
        headers: { 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'open-api-proxy' },
        signal: AbortSignal.timeout(10000),
      },
    );

    if (!response.ok) return null;

    const data = JSON.parse(await response.text()) as { tag_name?: string };
    const tag = data.tag_name?.replace(/^v/, '') || null;
    return tag;
  } catch {
    return null;
  }
}

export async function checkForUpdate(): Promise<string | null> {
  const current = getCurrentVersion();
  const latest = await getLatestVersion();
  if (latest && latest !== current) {
    return latest;
  }
  return null;
}
```

Create `src/update/executor.ts`:
```typescript
import { execSync } from 'child_process';

export async function execUpdate(): Promise<void> {
  try {
    console.log('Fetching latest release...');
    execSync('git fetch --tags', { cwd: process.cwd(), stdio: 'inherit' });

    // Get latest tag
    const tags = execSync('git tag --sort=-v:refname', { cwd: process.cwd() })
      .toString().trim().split('\n').filter(Boolean);
    const latestTag = tags[0];

    if (!latestTag) {
      console.error('No tags found');
      return;
    }

    console.log(`Checking out ${latestTag}...`);
    execSync(`git checkout ${latestTag}`, { cwd: process.cwd(), stdio: 'inherit' });

    // Check if package.json changed
    try {
      execSync('git diff HEAD~1 --name-only | grep package.json', { cwd: process.cwd(), stdio: 'pipe' });
      console.log('Installing dependencies...');
      execSync('npm install --production', { cwd: process.cwd(), stdio: 'inherit' });
    } catch {
      // No package.json changes
    }

    console.log('Update complete. Restarting...');
    process.exit(0);
  } catch (err) {
    console.error('Update failed:', (err as Error).message);
    process.exit(1);
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: implement config migration and auto-update systems"
```

---

### Task 10: React Frontend — Foundation + Layout

**Files:**
- Create: `ui/index.html`
- Create: `ui/src/main.tsx`
- Create: `ui/src/App.tsx`
- Create: `ui/src/index.css`
- Create: `ui/src/lib/utils.ts`
- Create: `ui/src/api/client.ts`
- Create: `ui/src/components/Layout.tsx`

- [ ] **Step 1: Create UI entry files**

Create `ui/index.html`:
```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>open-api-proxy</title>
</head>
<body class="bg-gray-50 dark:bg-gray-950">
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>
```

Create `ui/src/index.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
```

Create `ui/src/lib/utils.ts`:
```typescript
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

Create `ui/src/api/client.ts`:
```typescript
const BASE = '';

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(BASE + url, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
    throw new Error(err.error?.message || res.statusText);
  }
  return res.json();
}

export const apiClient = {
  getConfig: () => api<any>('/api/config'),
  updateConfig: (config: any) => api<any>('/api/config', { method: 'PUT', body: JSON.stringify(config) }),
  getProviders: () => api<Record<string, any>>('/api/providers'),
  createProvider: (key: string, data: any) => api<any>('/api/providers', { method: 'POST', body: JSON.stringify({ key, ...data }) }),
  updateProvider: (key: string, data: any) => api<any>(`/api/providers/${key}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteProvider: (key: string) => api<any>(`/api/providers/${key}`, { method: 'DELETE' }),
  getHealth: () => api<any>('/api/health'),
  getLogs: () => api<any[]>('/api/logs'),
  checkUpdate: () => api<{ current: string; latest: string; hasUpdate: boolean }>('/api/update/check'),
  executeUpdate: () => api<any>('/api/update/execute', { method: 'POST' }),
  getModels: () => api<{ object: string; data: Array<{ id: string }> }>('/v1/models'),
};
```

Create `ui/src/main.tsx`:
```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

Create `ui/src/App.tsx`:
```tsx
import { useState } from 'react';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Providers from './pages/Providers';
import Playground from './pages/Playground';
import Logs from './pages/Logs';
import Settings from './pages/Settings';

type Page = 'dashboard' | 'providers' | 'playground' | 'logs' | 'settings';

export default function App() {
  const [page, setPage] = useState<Page>('dashboard');

  const renderPage = () => {
    switch (page) {
      case 'dashboard': return <Dashboard />;
      case 'providers': return <Providers />;
      case 'playground': return <Playground />;
      case 'logs': return <Logs />;
      case 'settings': return <Settings />;
    }
  };

  return (
    <Layout currentPage={page} onNavigate={setPage}>
      {renderPage()}
    </Layout>
  );
}
```

Create `ui/src/components/Layout.tsx`:
```tsx
import { ReactNode } from 'react';
import { LayoutDashboard, Server, Play, ScrollText, Settings } from 'lucide-react';
import UpdateBanner from './UpdateBanner';

type Page = 'dashboard' | 'providers' | 'playground' | 'logs' | 'settings';

interface Props {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  children: ReactNode;
}

const navItems: Array<{ id: Page; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'dashboard', label: '仪表盘', icon: LayoutDashboard },
  { id: 'providers', label: '厂商管理', icon: Server },
  { id: 'playground', label: 'API 测试', icon: Play },
  { id: 'logs', label: '日志', icon: ScrollText },
  { id: 'settings', label: '设置', icon: Settings },
];

export default function Layout({ currentPage, onNavigate, children }: Props) {
  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-60 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col">
        <div className="p-5 border-b border-gray-200 dark:border-gray-800">
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">open-api-proxy</h1>
          <p className="text-xs text-gray-500 mt-1">LLM API 统一网关</p>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                currentPage === id
                  ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 font-medium'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <UpdateBanner />
        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create UpdateBanner component**

Create `ui/src/components/UpdateBanner.tsx`:
```tsx
import { useState, useEffect } from 'react';
import { apiClient } from '../api/client';

export default function UpdateBanner() {
  const [update, setUpdate] = useState<{ current: string; latest: string } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    apiClient.checkUpdate()
      .then((data) => { if (data.hasUpdate) setUpdate(data); })
      .catch(() => {});
  }, []);

  if (!update) return null;

  const handleUpdate = async () => {
    if (!confirm(`确认升级到 ${update.latest}？服务将自动重启。`)) return;
    setLoading(true);
    try {
      await apiClient.executeUpdate();
      setTimeout(() => window.location.reload(), 3000);
    } catch {
      setLoading(false);
    }
  };

  return (
    <div className="bg-amber-50 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-800 px-4 py-2 flex items-center justify-between text-sm">
      <span className="text-amber-800 dark:text-amber-200">
        新版本 {update.latest} 可用 (当前 {update.current})
      </span>
      <button
        onClick={handleUpdate}
        disabled={loading}
        className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-1 rounded text-xs font-medium disabled:opacity-50"
      >
        {loading ? '升级中...' : '立即升级'}
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Verify Vite builds**

Run: `npx vite build --config vite.config.ts`
Expected: Success, output in `dist/ui/`

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: scaffold React frontend with layout and navigation"
```

---

### Task 11: React Frontend — Dashboard + Providers Pages

**Files:**
- Create: `ui/src/pages/Dashboard.tsx`
- Create: `ui/src/pages/Providers.tsx`
- Create: `ui/src/components/ProviderEditor.tsx`
- Create: `ui/src/components/ModelTagInput.tsx`

- [ ] **Step 1: Implement Dashboard page**

Create `ui/src/pages/Dashboard.tsx`:
```tsx
import { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { Server, Box, Activity } from 'lucide-react';

interface Stats {
  providers: number;
  models: number;
  uptime: number;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({ providers: 0, models: 0, uptime: 0 });
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([apiClient.getProviders(), apiClient.getHealth(), apiClient.getModels()])
      .then(([providers, health, models]) => {
        const pCount = Object.keys(providers).length;
        const mCount = models.data?.length || 0;
        setStats({ providers: pCount, models: mCount, uptime: health.uptime || 0 });
      })
      .catch((err) => setError(err.message));
  }, []);

  const formatUptime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">仪表盘</h2>
      {error && <div className="text-red-500 mb-4">{error}</div>}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard icon={Server} label="厂商数" value={stats.providers} />
        <StatCard icon={Box} label="模型数" value={stats.models} />
        <StatCard icon={Activity} label="运行时间" value={formatUptime(stats.uptime)} />
      </div>
      <ProvidersSummary />
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string | number }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
      <div className="flex items-center gap-3">
        <Icon className="w-5 h-5 text-indigo-500" />
        <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
      </div>
      <p className="text-2xl font-bold mt-2 text-gray-900 dark:text-white">{value}</p>
    </div>
  );
}

function ProvidersSummary() {
  const [providers, setProviders] = useState<Record<string, any>>({});
  const [healthMap, setHealthMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    apiClient.getProviders().then(setProviders).catch(() => {});
  }, []);

  const checkHealth = async (key: string, baseUrl: string) => {
    try {
      await fetch(baseUrl + '/models', { signal: AbortSignal.timeout(5000) });
      setHealthMap((prev) => ({ ...prev, [key]: true }));
    } catch {
      setHealthMap((prev) => ({ ...prev, [key]: false }));
    }
  };

  useEffect(() => {
    Object.entries(providers).forEach(([key, p]) => { checkHealth(key, p.base_url); });
  }, [providers]);

  return (
    <div>
      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">厂商状态</h3>
      <div className="space-y-2">
        {Object.entries(providers).map(([key, p]) => {
          const health = healthMap[key];
          return (
            <div key={key} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-3 flex items-center justify-between">
              <div>
                <span className="font-medium text-gray-900 dark:text-white">{p.display_name || key}</span>
                <span className="text-xs text-gray-400 ml-2">{p.protocol}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400">{p.models?.length || 0} 个模型</span>
                <span className={`w-2 h-2 rounded-full ${health === undefined ? 'bg-gray-300' : health ? 'bg-green-500' : 'bg-red-500'}`} />
              </div>
            </div>
          );
        })}
        {Object.keys(providers).length === 0 && (
          <p className="text-gray-400 text-sm">暂无厂商。请在"厂商管理"页面添加。</p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Implement ProviderEditor component**

Create `ui/src/components/ProviderEditor.tsx`:
```tsx
import { useState } from 'react';
import { X } from 'lucide-react';
import ModelTagInput from './ModelTagInput';

interface Props {
  initial?: { key: string; display_name: string; base_url: string; api_key: string; protocol: string; models: string[] };
  onSave: (key: string, data: any) => void;
  onClose: () => void;
}

export default function ProviderEditor({ initial, onSave, onClose }: Props) {
  const [key, setKey] = useState(initial?.key || '');
  const [displayName, setDisplayName] = useState(initial?.display_name || '');
  const [baseUrl, setBaseUrl] = useState(initial?.base_url || '');
  const [apiKey, setApiKey] = useState(initial?.api_key || '');
  const [protocol, setProtocol] = useState(initial?.protocol || 'openai');
  const [models, setModels] = useState<string[]>(initial?.models || []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(key, { display_name: displayName, base_url: baseUrl, api_key: apiKey, protocol, models });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {initial ? '编辑厂商' : '添加厂商'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Key (标识符)</label>
            <input
              value={key}
              onChange={(e) => setKey(e.target.value)}
              disabled={!!initial}
              className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white disabled:opacity-50"
              placeholder="例如: openai, anthropic"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">显示名称</label>
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Base URL</label>
            <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">API Key</label>
            <input value={apiKey} onChange={(e) => setApiKey(e.target.value)} className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white" type="password" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">协议</label>
            <select value={protocol} onChange={(e) => setProtocol(e.target.value)} className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
              <option value="openai">OpenAI Chat</option>
              <option value="openai-responses">OpenAI Responses</option>
              <option value="anthropic">Anthropic Messages</option>
              <option value="gemini">Google Gemini</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">模型列表</label>
            <ModelTagInput tags={models} onChange={setModels} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg dark:text-gray-400 dark:hover:bg-gray-800">取消</button>
            <button type="submit" className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">保存</button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Implement ModelTagInput**

Create `ui/src/components/ModelTagInput.tsx`:
```tsx
import { useState } from 'react';
import { X } from 'lucide-react';

interface Props {
  tags: string[];
  onChange: (tags: string[]) => void;
}

export default function ModelTagInput({ tags, onChange }: Props) {
  const [input, setInput] = useState('');

  const addTag = () => {
    const trimmed = input.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
    }
    setInput('');
  };

  const removeTag = (tag: string) => {
    onChange(tags.filter((t) => t !== tag));
  };

  return (
    <div className="border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 flex flex-wrap gap-1">
      {tags.map((tag) => (
        <span key={tag} className="inline-flex items-center gap-1 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded text-xs">
          {tag}
          <button onClick={() => removeTag(tag)}><X className="w-3 h-3" /></button>
        </span>
      ))}
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
        className="flex-1 min-w-[100px] outline-none text-sm bg-transparent text-gray-900 dark:text-white"
        placeholder="输入模型名，回车添加"
      />
    </div>
  );
}
```

- [ ] **Step 4: Implement Providers page**

Create `ui/src/pages/Providers.tsx`:
```tsx
import { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import ProviderEditor from '../components/ProviderEditor';

export default function Providers() {
  const [providers, setProviders] = useState<Record<string, any>>({});
  const [editing, setEditing] = useState<{ key: string; data: any } | 'new' | null>(null);
  const [error, setError] = useState('');

  const load = () => {
    apiClient.getProviders().then(setProviders).catch((err) => setError(err.message));
  };

  useEffect(() => { load(); }, []);

  const handleSave = async (key: string, data: any) => {
    try {
      if (editing === 'new') {
        await apiClient.createProvider(key, data);
      } else {
        await apiClient.updateProvider(key, data);
      }
      setEditing(null);
      load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDelete = async (key: string) => {
    if (!confirm(`删除厂商 "${key}"？`)) return;
    try {
      await apiClient.deleteProvider(key);
      load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">厂商管理</h2>
        <button onClick={() => setEditing('new')} className="flex items-center gap-1 bg-indigo-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-indigo-700">
          <Plus className="w-4 h-4" /> 添加厂商
        </button>
      </div>

      {error && <div className="text-red-500 text-sm mb-4">{error}</div>}

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
            <tr>
              <th className="text-left px-4 py-3 font-medium">名称</th>
              <th className="text-left px-4 py-3 font-medium">Key</th>
              <th className="text-left px-4 py-3 font-medium">协议</th>
              <th className="text-left px-4 py-3 font-medium">模型数</th>
              <th className="text-left px-4 py-3 font-medium">Base URL</th>
              <th className="text-right px-4 py-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
            {Object.entries(providers).map(([key, p]) => (
              <tr key={key} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="px-4 py-3 text-gray-900 dark:text-white font-medium">{p.display_name || key}</td>
                <td className="px-4 py-3 text-gray-500">{key}</td>
                <td className="px-4 py-3">
                  <span className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded text-xs">{p.protocol}</span>
                </td>
                <td className="px-4 py-3 text-gray-500">{p.models?.length || 0}</td>
                <td className="px-4 py-3 text-gray-400 font-mono text-xs truncate max-w-[200px]">{p.base_url}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => setEditing({ key, data: p })} className="text-gray-400 hover:text-indigo-500 mr-2"><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => handleDelete(key)} className="text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                </td>
              </tr>
            ))}
            {Object.keys(providers).length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">暂无厂商，点击"添加厂商"开始</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <ProviderEditor
          initial={editing === 'new' ? undefined : { key: editing.key, ...editing.data }}
          onSave={handleSave}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: implement Dashboard and Providers pages"
```

---

### Task 12: React Frontend — Playground + Logs + Settings Pages

**Files:**
- Create: `ui/src/pages/Playground.tsx`
- Create: `ui/src/components/LogStream.tsx`
- Create: `ui/src/pages/Logs.tsx`
- Create: `ui/src/pages/Settings.tsx`

- [ ] **Step 1: Implement Playground page**

Create `ui/src/pages/Playground.tsx`:
```tsx
import { useState, useEffect, useRef } from 'react';
import { apiClient } from '../api/client';
import { Send, Loader2 } from 'lucide-react';

export default function Playground() {
  const [endpoint, setEndpoint] = useState('/v1/chat/completions');
  const [model, setModel] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [userMessage, setUserMessage] = useState('');
  const [stream, setStream] = useState(true);
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(4096);
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const responseRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    apiClient.getModels().then((data) => {
      setModels(data.data?.map((m: any) => m.id) || []);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (responseRef.current) responseRef.current.scrollTop = responseRef.current.scrollHeight;
  }, [response]);

  const handleSend = async () => {
    if (!model || !userMessage) return;
    setLoading(true);
    setResponse('');

    const body: any = {
      model,
      messages: [
        ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
        { role: 'user', content: userMessage },
      ],
      stream,
      temperature,
    };

    if (endpoint === '/v1/chat/completions') {
      body.max_completion_tokens = maxTokens;
    } else if (endpoint === '/v1/messages') {
      body.max_tokens = maxTokens;
    } else if (endpoint === '/v1/responses') {
      body.max_output_tokens = maxTokens;
    }

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.text();
        setResponse(`Error ${res.status}: ${err}`);
        setLoading(false);
        return;
      }

      if (stream && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            if (line.startsWith('data: ') && line !== 'data: [DONE]') {
              try {
                const chunk = JSON.parse(line.slice(6));
                const content = chunk.choices?.[0]?.delta?.content ||
                  chunk.delta?.text || chunk.content?.[0]?.text || '';
                if (content) setResponse((prev) => prev + content);
              } catch {}
            }
          }
        }
      } else {
        const data = await res.json();
        setResponse(JSON.stringify(data, null, 2));
      }
    } catch (err: any) {
      setResponse(`Error: ${err.message}`);
    }
    setLoading(false);
  };

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">API 测试</h2>
      <div className="grid grid-cols-2 gap-6">
        {/* Request builder */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">端点</label>
            <select value={endpoint} onChange={(e) => setEndpoint(e.target.value)} className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
              <option value="/v1/chat/completions">/v1/chat/completions (OpenAI Chat)</option>
              <option value="/v1/messages">/v1/messages (Anthropic Messages)</option>
              <option value="/v1/responses">/v1/responses (OpenAI Responses)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Model (provider/model)</label>
            <input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              placeholder="例如: openai/gpt-5"
              list="model-list"
            />
            <datalist id="model-list">
              {models.map((m) => <option key={m} value={m} />)}
            </datalist>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">System Prompt</label>
            <textarea value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} rows={2} className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">User Message</label>
            <textarea value={userMessage} onChange={(e) => setUserMessage(e.target.value)} rows={4} className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white" placeholder="输入你的消息..." />
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Temperature: {temperature}</label>
              <input type="range" min="0" max="2" step="0.1" value={temperature} onChange={(e) => setTemperature(parseFloat(e.target.value))} className="w-full" />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Max Tokens</label>
              <input type="number" value={maxTokens} onChange={(e) => setMaxTokens(parseInt(e.target.value))} className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={stream} onChange={(e) => setStream(e.target.checked)} id="stream" />
            <label htmlFor="stream" className="text-sm text-gray-700 dark:text-gray-300">流式输出</label>
          </div>
          <button onClick={handleSend} disabled={loading || !model || !userMessage} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {loading ? '请求中...' : '发送'}
          </button>
        </div>

        {/* Response viewer */}
        <div className="bg-gray-900 rounded-xl p-4 overflow-auto max-h-[600px]">
          <pre ref={responseRef} className="text-green-400 text-sm whitespace-pre-wrap font-mono">{response || '响应将显示在这里...'}</pre>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Implement LogStream component + Logs page**

Create `ui/src/components/LogStream.tsx`:
```tsx
import { useEffect, useState } from 'react';

export default function LogStream() {
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    const es = new EventSource('/api/logs/stream');
    es.onmessage = (e) => {
      try {
        const entry = JSON.parse(e.data);
        if (entry.type !== 'heartbeat') {
          setLogs((prev) => [...prev.slice(-199), entry]);
        }
      } catch {}
    };
    es.onerror = () => { es.close(); };
    return () => es.close();
  }, []);

  return (
    <div className="bg-gray-900 rounded-xl p-4 h-[500px] overflow-auto font-mono text-xs">
      {logs.map((entry, i) => (
        <div key={i} className="flex gap-3 py-0.5">
          <span className="text-gray-500 shrink-0">{new Date(entry.timestamp).toLocaleTimeString()}</span>
          <span className={`shrink-0 ${entry.level === 'error' ? 'text-red-400' : entry.level === 'warn' ? 'text-amber-400' : 'text-gray-400'}`}>{entry.level}</span>
          <span className="text-gray-300">{entry.message}</span>
        </div>
      ))}
      {logs.length === 0 && <span className="text-gray-500">等待日志...</span>}
    </div>
  );
}
```

Create `ui/src/pages/Logs.tsx`:
```tsx
import LogStream from '../components/LogStream';

export default function Logs() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">实时日志</h2>
        <button onClick={() => window.location.reload()} className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">清空</button>
      </div>
      <LogStream />
    </div>
  );
}
```

- [ ] **Step 3: Implement Settings page**

Create `ui/src/pages/Settings.tsx`:
```tsx
import { useState, useEffect } from 'react';
import { apiClient } from '../api/client';

export default function Settings() {
  const [config, setConfig] = useState<any>(null);
  const [saved, setSaved] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<any>(null);

  useEffect(() => {
    apiClient.getConfig().then(setConfig).catch(() => {});
    apiClient.checkUpdate().then(setUpdateInfo).catch(() => {});
  }, []);

  const handleSave = async () => {
    if (!config) return;
    await apiClient.updateConfig(config);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'config-export.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const imported = JSON.parse(ev.target?.result as string);
        await apiClient.updateConfig(imported);
        setConfig(imported);
        alert('配置已导入');
      } catch (err: any) {
        alert('导入失败: ' + err.message);
      }
    };
    reader.readAsText(file);
  };

  if (!config) return <div className="text-gray-400">加载中...</div>;

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">系统设置</h2>

      <div className="space-y-6 max-w-2xl">
        {/* Server Settings */}
        <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
          <h3 className="font-medium text-gray-900 dark:text-white mb-3">服务器</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">端口</label>
              <input type="number" value={config.server?.port || 6312} onChange={(e) => setConfig({ ...config, server: { ...config.server, port: parseInt(e.target.value) } })} className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Host</label>
              <input value={config.server?.host || '0.0.0.0'} onChange={(e) => setConfig({ ...config, server: { ...config.server, host: e.target.value } })} className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
            </div>
          </div>
        </section>

        {/* Proxy Settings */}
        <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
          <h3 className="font-medium text-gray-900 dark:text-white mb-3">代理</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">超时 (ms)</label>
              <input type="number" value={config.proxy?.timeout || 120000} onChange={(e) => setConfig({ ...config, proxy: { ...config.proxy, timeout: parseInt(e.target.value) } })} className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">日志级别</label>
              <select value={config.logging?.level || 'info'} onChange={(e) => setConfig({ ...config, logging: { ...config.logging, level: e.target.value } })} className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
                <option value="debug">debug</option>
                <option value="info">info</option>
                <option value="warn">warn</option>
                <option value="error">error</option>
              </select>
            </div>
          </div>
        </section>

        {/* Update */}
        <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
          <h3 className="font-medium text-gray-900 dark:text-white mb-3">版本更新</h3>
          <p className="text-sm text-gray-500 mb-2">
            当前版本: {updateInfo?.current || '-'} {updateInfo?.hasUpdate ? `→ ${updateInfo.latest}` : '(已是最新)'}
          </p>
        </section>

        {/* Import / Export */}
        <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
          <h3 className="font-medium text-gray-900 dark:text-white mb-3">配置导入/导出</h3>
          <div className="flex gap-3">
            <button onClick={handleExport} className="px-4 py-2 text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700">导出配置</button>
            <label className="px-4 py-2 text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 cursor-pointer">
              导入配置
              <input type="file" accept=".json,.yaml" onChange={handleImport} className="hidden" />
            </label>
          </div>
        </section>

        <button onClick={handleSave} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700">
          {saved ? '已保存' : '保存设置'}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Build frontend**

Run: `npx vite build --config vite.config.ts`
Expected: Success

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: implement Playground, Logs, and Settings pages"
```

---

### Task 13: Integration Test + Final Polish

**Files:**
- Create: `tests/e2e/api-proxy.test.ts`
- Modify: `package.json` (test script)

- [ ] **Step 1: Write integration test**

Create `tests/e2e/api-proxy.test.ts`:
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import { loadConfig } from '../../src/config/loader.js';
import { createApp } from '../../src/server/app.js';
import { registerAllConverters } from '../../src/converters/index.js';
import { writeFileSync, unlinkSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const tmpDir = join(tmpdir(), 'oap-e2e-' + Date.now());
const configPath = join(tmpDir, 'config.yaml');

let server: any;
let port: number;

beforeAll(async () => {
  mkdirSync(tmpDir, { recursive: true });

  const testYaml = `
server:
  port: 0
  host: "127.0.0.1"
  cors: true
proxy:
  timeout: 30000
  keep_alive: true
  user_agent_override: ""
  preserve_headers: []
providers:
  test-openai:
    display_name: "Test OpenAI"
    base_url: "${process.env.TEST_OPENAI_BASE_URL || 'http://localhost:9999/v1'}"
    api_key: "sk-test"
    protocol: openai
    models:
      - gpt-4o
  test-anthropic:
    display_name: "Test Anthropic"
    base_url: "${process.env.TEST_ANTHROPIC_BASE_URL || 'http://localhost:9998'}"
    api_key: "sk-ant-test"
    protocol: anthropic
    models:
      - claude-sonnet-4-20250514
conversions:
  anthropic_to_openai: true
  openai_to_anthropic: true
  anthropic_to_openai_responses: true
  openai_to_anthropic_responses: false
  openai_chat_to_responses: true
  responses_to_openai_chat: true
logging:
  level: error
  dir: logs
  max_files: 1
`;
  writeFileSync(configPath, testYaml);

  const config = loadConfig(configPath);
  registerAllConverters();
  const app = await createApp(config);
  await app.listen({ port: 0, host: '127.0.0.1' });
  server = app.server;
  port = (server.address() as any).port;
});

afterAll(async () => {
  if (server) server.close();
  try { unlinkSync(configPath); } catch {}
});

function api(path: string, options?: RequestInit) {
  return fetch(`http://127.0.0.1:${port}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
}

describe('E2E: API Endpoints', () => {
  it('GET /api/health returns ok', async () => {
    const res = await api('/api/health');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
  });

  it('GET /api/providers returns providers', async () => {
    const res = await api('/api/providers');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('test-openai');
    expect(body).toHaveProperty('test-anthropic');
  });

  it('GET /v1/models returns all models', async () => {
    const res = await api('/v1/models');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.object).toBe('list');
    const ids = body.data.map((m: any) => m.id);
    expect(ids).toContain('test-openai/gpt-4o');
    expect(ids).toContain('test-anthropic/claude-sonnet-4-20250514');
  });

  it('POST /v1/chat/completions returns error for invalid model format', async () => {
    const res = await api('/v1/chat/completions', {
      method: 'POST',
      body: JSON.stringify({ model: 'invalid-format', messages: [] }),
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('POST /v1/chat/completions returns provider not found', async () => {
    const res = await api('/v1/chat/completions', {
      method: 'POST',
      body: JSON.stringify({ model: 'nonexistent/gpt-4o', messages: [] }),
    });
    expect(res.status).toBe(404);
  });

  it('GET /api/config returns full config', async () => {
    const res = await api('/api/config');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('_schema_version');
  });

  it('POST/PUT/DELETE /api/providers CRUD', async () => {
    // Create
    const createRes = await api('/api/providers', {
      method: 'POST',
      body: JSON.stringify({
        key: 'temp-provider',
        display_name: 'Temp',
        base_url: 'https://temp.com',
        api_key: 'sk-temp',
        protocol: 'openai',
        models: ['temp-model'],
      }),
    });
    expect(createRes.status).toBe(201);

    // Read
    const getRes = await api('/api/providers');
    const providers = await getRes.json();
    expect(providers).toHaveProperty('temp-provider');

    // Update
    const updateRes = await api('/api/providers/temp-provider', {
      method: 'PUT',
      body: JSON.stringify({
        display_name: 'Temp Updated',
        base_url: 'https://temp2.com',
        api_key: 'sk-temp2',
        protocol: 'openai',
        models: ['temp-model', 'temp-model-2'],
      }),
    });
    expect(updateRes.status).toBe(200);

    // Delete
    const deleteRes = await api('/api/providers/temp-provider', { method: 'DELETE' });
    expect(deleteRes.status).toBe(200);

    // Verify deleted
    const getRes2 = await api('/api/providers');
    const providers2 = await getRes2.json();
    expect(providers2).not.toHaveProperty('temp-provider');
  });
});
```

- [ ] **Step 2: Run integration tests**

Run: `npx vitest run tests/e2e/`
Expected: PASS (7 tests)

- [ ] **Step 3: Run all tests**

Run: `npx vitest run`
Expected: All tests PASS

- [ ] **Step 4: Final TypeScript compilation check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Build production**

Run: `npx tsc && npx vite build --config vite.config.ts`
Expected: Success

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "test: add integration tests and finalize build"
```

---

## Implementation Order

```
Task 1   → Project scaffolding
Task 2   → Config system (loader + writer)
Task 3   → Converter registry + helpers
Task 4   → Anthropic ↔ OpenAI Chat converter
Task 5   → Anthropic ↔ OpenAI Responses converter
Task 6   → OpenAI Chat ↔ OpenAI Responses converter
Task 7   → Proxy engine (router + forwarder + stream)
Task 8   → Fastify server + all API routes
Task 9   → Migration + update systems
Task 10  → Frontend foundation + layout
Task 11  → Dashboard + Providers pages
Task 12  → Playground + Logs + Settings pages
Task 13  → Integration tests + final polish
```

Tasks 1-2 can be done in parallel. Tasks 3-6 are sequential (converters build on each other). Tasks 7-8 can start after Task 2. Tasks 10-12 can start after Task 8.
