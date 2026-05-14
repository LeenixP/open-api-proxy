# open-api-proxy

> 一个轻量级的本地 API 代理，为所有 LLM 服务商提供统一的 HTTP 入口，并自动完成协议格式转换。

open-api-proxy 让你只需记住一个地址，即可调用 OpenAI、Anthropic、DeepSeek 等所有主流大模型 API。在请求中指定 `provider/model`，它会自动路由到正确的服务商，并在不同协议之间进行无损转换。

---

## 特性

- **统一入口**：一个地址管理所有模型 API，告别多份配置
- **自动路由**：通过 `provider/model` 格式自动解析并路由到对应服务商
- **六向协议转换**：OpenAI Chat、Anthropic Messages、OpenAI Responses 三大协议之间全自动互转
- **流式支持**：SSE 流式响应实时转换，体验原生一致
- **Web 管理界面**：内置 React 管理后台，支持厂商配置、API 测试、实时日志、系统设置
- **配置即代码**：单文件 `config.yaml` 管理全部配置，支持环境变量注入
- **自动更新**：内置版本检测与一键更新机制
- **零依赖部署**：单二进制文件 / `npm start` 即可运行

---

## 快速开始

### 安装

```bash
npm install -g open-api-proxy
```

或克隆源码：

```bash
git clone https://github.com/leenixp/open-api-proxy.git
cd open-api-proxy
npm install
npm run build
```

### 配置

创建 `config.yaml`：

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

### 运行

```bash
# 使用全局安装
open-api-proxy

# 或源码运行
npm start

# 开发模式（带热重载）
npm run dev
```

服务启动后访问：
- API 代理：`http://localhost:6312`
- 管理界面：`http://localhost:6312/`

---

## 配置详解

`config.yaml` 是唯一的配置文件，采用分层结构：

| 区块 | 说明 |
|------|------|
| `server` | 服务监听端口、Host、CORS 开关 |
| `proxy` | 超时时间、连接保持、User-Agent、透传 Header |
| `providers` | 各服务商的配置（名称、地址、密钥、协议、模型列表） |
| `conversions` | 六向协议转换的开关 |
| `logging` | 日志级别、存储目录、保留文件数 |

### 环境变量注入

`api_key` 支持 `${ENV_VAR}` 语法，从环境变量读取密钥：

```yaml
api_key: "${OPENAI_API_KEY}"
```

启动前设置：

```bash
export OPENAI_API_KEY="sk-..."
export ANTHROPIC_API_KEY="sk-ant-..."
export DEEPSEEK_API_KEY="sk-..."
```

### 配置示例：OpenAI

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

### 配置示例：Anthropic

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

### 配置示例：DeepSeek

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

## 使用方式

### 模型命名格式

所有请求通过 `provider/model` 格式指定模型：

```
openai/gpt-4o
anthropic/claude-sonnet-4-20250514
deepseek/deepseek-chat
```

### OpenAI Chat 协议

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

### Anthropic Messages 协议

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

### OpenAI Responses 协议

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

### 流式请求

将 `"stream": true` 即可启用 SSE 流式输出，代理会实时转换流事件格式：

```bash
curl -N -X POST http://localhost:6312/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek/deepseek-chat",
    "messages": [{"role": "user", "content": "讲个故事"}],
    "stream": true
  }'
```

### 获取模型列表

```bash
curl http://localhost:6312/v1/models
```

返回所有已配置服务商的模型聚合列表，格式为 `provider/model`。

---

## 协议转换矩阵

open-api-proxy 支持三大 LLM API 协议之间的六向自动转换：

| 源协议 | 目标协议 | 说明 |
|--------|----------|------|
| Anthropic Messages | OpenAI Chat | 内容块数组转平面消息，支持 tool_use/tool_result 映射 |
| OpenAI Chat | Anthropic Messages | 平面消息转内容块数组，支持 tool_calls/tool 映射 |
| Anthropic Messages | OpenAI Responses | 内容块架构最接近，转换最无损 |
| OpenAI Responses | Anthropic Messages | 支持 reasoning、function_call 映射 |
| OpenAI Chat | OpenAI Responses | messages 转 input 数组，tools 格式转换 |
| OpenAI Responses | OpenAI Chat | input 数组转 messages，支持输出还原 |

### 转换细节

- **请求转换**：model 字段自动剥离 `provider/` 前缀，其余字段按协议映射
- **响应转换**：非流式响应整体转换为目标协议格式
- **流式转换**：SSE 事件逐条实时转换，保持流式体验
- **错误转换**：上游错误状态码和响应体转换为客户期望的格式
- **特殊字段**：
  - `thinking` (Anthropic) ↔ `reasoning_effort` (OpenAI)
  - `max_tokens` ↔ `max_completion_tokens` ↔ `max_output_tokens`
  - `tool_use` / `tool_result` ↔ `tool_calls` / `tool`
  - `top_k` 等无法映射的字段会被丢弃并记录 debug 日志

---

## Web 管理界面

访问 `http://localhost:6312/` 打开管理后台，包含 5 个功能页面：

### 1. 仪表盘
查看服务商数量、模型总数、运行时间，以及各服务商的实时健康状态（通过探测 base_url 可用性）。

### 2. 厂商管理
- 增删改查所有服务商配置
- 支持设置显示名称、Base URL、API 密钥、协议类型、模型列表
- 所有修改实时写入 `config.yaml`

### 3. API 测试
- 可视化选择端点（`/v1/chat/completions`、`/v1/messages`、`/v1/responses`）
- 选择模型、填写 System Prompt 和 User Message
- 调节 Temperature 和 Max Tokens
- 支持流式/非流式切换，实时查看响应

### 4. 实时日志
通过 SSE 连接 `/api/logs/stream`，实时展示代理运行日志，支持按级别着色和清空操作。

### 5. 系统设置
- 修改服务器端口、Host
- 调整代理超时时间和日志级别
- 检查版本更新
- 配置导入/导出（JSON 格式）

---

## API 端点参考

### 代理端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/v1/chat/completions` | POST | OpenAI Chat 协议入口 |
| `/v1/messages` | POST | Anthropic Messages 协议入口 |
| `/v1/responses` | POST | OpenAI Responses 协议入口 |
| `/v1/models` | GET | 聚合所有服务商的模型列表 |

### 管理端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/config` | GET / PUT | 读取 / 写入完整配置 |
| `/api/providers` | GET / POST | 获取列表 / 创建厂商 |
| `/api/providers/:key` | PUT / DELETE | 更新 / 删除指定厂商 |
| `/api/health` | GET | 健康检查 |
| `/api/logs` | GET | 获取最近 200 条日志 |
| `/api/logs/stream` | GET | SSE 实时日志流 |
| `/api/update/check` | GET | 检查新版本 |
| `/api/update/execute` | POST | 执行一键更新 |
| `/` | GET | React 管理界面 |

---

## 开发

### 环境要求

- Node.js >= 20.0.0

### 本地开发

```bash
# 克隆仓库
git clone https://github.com/leenixp/open-api-proxy.git
cd open-api-proxy

# 安装依赖
npm install

# 启动开发服务器（前后端同时热重载）
npm run dev

# 运行测试
npm test

# 构建生产版本
npm run build
```

### 项目结构

```
open-api-proxy/
├── package.json / tsconfig.json / vite.config.ts
├── config.yaml
├── src/
│   ├── index.ts              # 入口
│   ├── config/               # 配置加载与类型定义
│   ├── server/               # Fastify 服务、路由、中间件
│   ├── proxy/                # 路由解析、请求转发、流处理
│   ├── converters/           # 六向协议转换引擎
│   ├── migrations/           # 配置 schema 迁移
│   └── update/               # 版本检测与更新执行
├── ui/                       # React 管理界面
│   └── src/pages/            # Dashboard、Providers、Playground、Logs、Settings
└── tests/                    # 单元测试 + 集成测试
```

---

## 架构

### 请求流程

```
客户端
  │
  ▼
┌──────────────────────────────────────────────────┐
│                open-api-proxy                    │
│                                                  │
│  Fastify HTTP Server                             │
│  ├── /v1/chat/completions  (OpenAI Chat)         │
│  ├── /v1/messages          (Anthropic Messages)  │
│  ├── /v1/responses         (OpenAI Responses)    │
│  └── /v1/models                                  │
│         │                                        │
│         ▼                                        │
│  代理引擎                                        │
│  ├── 路由器:   解析 provider/model, 定位服务商   │
│  ├── 故障转移: 检测不健康服务商, 自动切换        │
│  └── 转发器:   向上游发送 HTTP 请求              │
│         │                                        │
│         ▼                                        │
│  转换器管道                                      │
│  ├── 请求转换 (客户端格式 → 上游格式)            │
│  └── 响应转换 (上游格式 → 客户端格式)            │
│         │                                        │
└─────────┼────────────────────────────────────────┘
          │
          ▼
┌─────────────────────┐
│  健康检查器          │
│  熔断断路器,         │
│  冷却期管理           │
└─────────────────────┘
          │
          ▼
┌─────────────────────┐
│  上游服务商          │
│  (OpenAI, Anthropic,│
│   DeepSeek 等)      │
└─────────────────────┘
```

### 组件架构

- **Fastify 服务器** -- 高性能 HTTP 服务器，处理所有入站请求。提供路由注册、中间件钩子（认证、限流、日志、安全头）和管理界面静态文件服务。

- **代理引擎** -- 核心路由与转发层。`路由器` 解析 `provider/model` 格式，定位对应的上游服务商。`故障转移` 模块监控服务商健康状态，自动重定向到健康替代项。`转发器` 向上游服务商发送 HTTP 请求并流式回传响应。

- **转换器管道** -- 六向双向协议转换引擎。每个转换器处理一个方向（例如 Anthropic Messages 到 OpenAI Chat）。管道根据客户端协议和上游服务商协议选择对应的转换器。所有转换器实现统一接口以保持一致性。

- **健康检查器** -- 使用熔断断路器模式监控服务商可用性。连续失败达到配置的阈值后，服务商进入冷却期，请求自动路由到具有匹配模型的故障转移目标。

### 数据流

**非流式请求:**
1. 客户端向代理端点发送 JSON 请求
2. 代理解析 `provider/model` 并查找服务商配置
3. 如果服务商协议与客户端协议不同，转换请求体
4. 将（可能已转换的）请求转发到上游服务商
5. 接收完整的上游响应
6. 如果协议不同，将响应转换为客户端期望的格式
7. 将（可能已转换的）响应发送回客户端

**流式请求 (`stream: true`):**
1. 客户端发送带 `"stream": true` 的 JSON 请求
2. 执行非流式流程的步骤 1-3
3. 代理与上游服务商建立流式 HTTP 连接
4. 从上游接收到每条 SSE 事件时，实时转换并转发给客户端
5. 连接保持打开，直到上游发送 `[DONE]` 信号（或等效信号）
6. 上游的错误事件被转换并内嵌转发，保持流式体验

---

## 部署

### Docker

使用 Docker 构建和运行：

```bash
docker build -t open-api-proxy .
docker run -d \
  --name open-api-proxy \
  -p 6312:6312 \
  -v $(pwd)/config:/app/config \
  -v $(pwd)/logs:/app/logs \
  -e MANAGEMENT_API_KEY=your-secret-key \
  open-api-proxy
```

### Systemd (Linux)

创建 `/etc/systemd/system/open-api-proxy.service`：

```ini
[Unit]
Description=open-api-proxy - LLM API Proxy
After=network.target

[Service]
Type=simple
User=open-api-proxy
WorkingDirectory=/opt/open-api-proxy
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production
Environment=MANAGEMENT_API_KEY=your-secret-key

# 安全加固
NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=yes
ReadWritePaths=/opt/open-api-proxy/logs /opt/open-api-proxy/config

[Install]
WantedBy=multi-user.target
```

启用并启动服务：

```bash
sudo systemctl daemon-reload
sudo systemctl enable open-api-proxy
sudo systemctl start open-api-proxy
```

### Nginx 反向代理

用于生产环境部署（含 TLS 终止）的 Nginx 配置示例：

```nginx
server {
    listen 443 ssl;
    server_name proxy.example.com;

    ssl_certificate     /etc/nginx/ssl/proxy.crt;
    ssl_certificate_key /etc/nginx/ssl/proxy.key;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    # 代理 API 请求
    location /v1/ {
        proxy_pass http://127.0.0.1:6312;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # SSE 流式支持
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 300s;
    }

    # 代理管理 API
    location /api/ {
        proxy_pass http://127.0.0.1:6312;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # 代理管理界面
    location / {
        proxy_pass http://127.0.0.1:6312;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }
}
```

---

## 许可证

[MIT](LICENSE)
