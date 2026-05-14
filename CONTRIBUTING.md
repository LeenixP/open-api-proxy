# Contributing to open-api-proxy

Thanks for your interest in contributing! This document outlines the development workflow.

## Development Setup

```bash
git clone https://github.com/leenixp/open-api-proxy.git
cd open-api-proxy
npm install
npm run dev
```

The `dev` script starts three watch processes in parallel: TypeScript type checking, Vite frontend build, and server hot reload.

## Project Structure

```
src/           # Backend (Node.js + TypeScript + Fastify)
  config/      # Config loader, writer, defaults, provider presets
  converters/  # 6-way protocol conversion engine
  proxy/       # Route resolver, upstream forwarder, stream handler, health checker
  server/      # Fastify app, routes, middleware (auth, rate-limit, logger)
  migrations/  # Config schema versioning
ui/            # Frontend (React + TypeScript + Tailwind CSS)
  src/pages/   # Dashboard, Providers, Playground, Logs, Settings
  src/i18n/    # Chinese/English translations
tests/         # Vitest test suites
```

## Testing

```bash
npm test              # Run all tests
npx vitest run        # Same as above
npx vitest tests/ui/  # Run UI component tests only
```

- Backend tests use the `node` environment
- Frontend tests use `jsdom` with `@testing-library/react`
- E2E tests use `nock` for upstream mocking

## Code Style

- TypeScript strict mode enabled
- No `any` types — use `unknown` and narrow properly
- Chinese for UI text (with i18n), English for code and comments
- Use `t()` from `ui/src/i18n` for all user-facing strings
- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/)

## Adding Provider Presets

Edit `src/config/presets.ts` and add a new entry:

```typescript
const myprovider: ProviderPreset = {
  display_name: 'My Provider',
  base_url: 'https://api.myprovider.com/v1',
  api_key: '${MY_PROVIDER_API_KEY}',
  protocol: 'openai',
  website: 'https://myprovider.com/keys',
  models: ['model-1', 'model-2'],
};
```

## Adding Protocol Converters

1. Create a converter class or object implementing the `Converter` interface in `src/types.ts`
2. Register it in `src/converters/index.ts`
3. Add comprehensive tests covering request conversion, response conversion, stream chunks, and error mapping
