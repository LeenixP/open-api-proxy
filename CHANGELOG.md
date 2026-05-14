# Changelog

All notable changes to this project will be documented in this file.

## [0.1.0] - 2026-05-14

### Added
- Initial release of open-api-proxy
- 6-way protocol conversion engine (OpenAI Chat, Anthropic Messages, OpenAI Responses)
- 31 built-in provider presets (19 international, 12 Chinese market)
- Provider health monitoring with circuit breaker pattern
- Automatic failover between providers with matching models and protocols
- Web management UI with 5 pages (Dashboard, Providers, Playground, Logs, Settings)
- Configurable rate limiting for management and proxy endpoints
- Optional management API authentication via MANAGEMENT_API_KEY
- File-based logging with automatic rotation
- Docker deployment support with multi-stage build
- Internationalization (Chinese and English)
- Dark mode with manual toggle and system preference detection
- Responsive design with mobile sidebar
- Provider preset import API
- Graceful shutdown handling
- YAML configuration with environment variable substitution
