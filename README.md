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

## 许可证

[MIT](LICENSE)
