import type { ProviderPreset } from '../types.js';

// ---------------------------------------------------------------------------
// International Providers (OpenAI-compatible)
// ---------------------------------------------------------------------------

/*
 * OpenAI
 * API key page: https://platform.openai.com/api-keys
 */
const openai: ProviderPreset = {
  display_name: 'OpenAI',
  base_url: 'https://api.openai.com/v1',
  api_key: '${OPENAI_API_KEY}',
  protocol: 'openai',
  website: 'https://platform.openai.com/api-keys',
  models: [
    'gpt-5',
    'gpt-4o',
    'gpt-4o-mini',
    'o3',
    'o4-mini',
    'gpt-4.1',
    'gpt-4.1-mini',
    'gpt-4.1-nano',
  ],
};

/*
 * Anthropic
 * API key page: https://console.anthropic.com/keys
 */
const anthropic: ProviderPreset = {
  display_name: 'Anthropic',
  base_url: 'https://api.anthropic.com',
  api_key: '${ANTHROPIC_API_KEY}',
  protocol: 'anthropic',
  website: 'https://console.anthropic.com/keys',
  models: [
    'claude-sonnet-4-20250514',
    'claude-opus-4-20250514',
    'claude-3.5-haiku-20241022',
    'claude-3.5-sonnet-20241022',
  ],
};

/*
 * Google Gemini
 * API key page: https://aistudio.google.com/apikey
 */
const google: ProviderPreset = {
  display_name: 'Google Gemini',
  base_url: 'https://generativelanguage.googleapis.com/v1beta',
  api_key: '${GOOGLE_API_KEY}',
  protocol: 'openai',
  website: 'https://aistudio.google.com/apikey',
  models: [
    'gemini-2.5-flash',
    'gemini-2.5-pro',
    'gemini-2.0-flash',
    'gemini-1.5-pro',
    'gemini-1.5-flash',
  ],
};

/*
 * Groq
 * API key page: https://console.groq.com/keys
 */
const groq: ProviderPreset = {
  display_name: 'Groq',
  base_url: 'https://api.groq.com/openai/v1',
  api_key: '${GROQ_API_KEY}',
  protocol: 'openai',
  website: 'https://console.groq.com/keys',
  models: [
    'llama-4-scout-17b-64e-instruct',
    'llama-4-maverick-17b-128e-instruct',
    'llama-3.3-70b-versatile',
    'deepseek-r1-distill-llama-70b',
    'mixtral-8x7b-32768',
    'gemma2-9b-it',
    'llama-3.1-8b-instant',
    'qwen-qwq-32b',
  ],
};

/*
 * Together AI
 * API key page: https://api.together.ai/settings/api-keys
 */
const together: ProviderPreset = {
  display_name: 'Together AI',
  base_url: 'https://api.together.xyz/v1',
  api_key: '${TOGETHER_API_KEY}',
  protocol: 'openai',
  website: 'https://api.together.ai/settings/api-keys',
  models: [
    'meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8',
    'meta-llama/Llama-4-Scout-17B-64E-Instruct',
    'deepseek-ai/DeepSeek-R1',
    'deepseek-ai/DeepSeek-V3',
    'Qwen/Qwen2.5-72B-Instruct',
    'mistralai/Mixtral-8x7B-Instruct-v0.1',
    'meta-llama/Llama-3.3-70B-Instruct',
  ],
};

/*
 * Fireworks AI
 * API key page: https://fireworks.ai/api-keys
 */
const fireworks: ProviderPreset = {
  display_name: 'Fireworks AI',
  base_url: 'https://api.fireworks.ai/inference/v1',
  api_key: '${FIREWORKS_API_KEY}',
  protocol: 'openai',
  website: 'https://fireworks.ai/api-keys',
  models: [
    'accounts/fireworks/models/llama-v3p3-70b-instruct',
    'accounts/fireworks/models/mixtral-8x22b-instruct',
    'accounts/fireworks/models/deepseek-r1',
    'accounts/fireworks/models/qwen2p5-72b-instruct',
    'accounts/fireworks/models/deepseek-v3',
    'accounts/fireworks/models/llama4-maverick-17b-128e-instruct',
  ],
};

/*
 * DeepSeek
 * API key page: https://platform.deepseek.com/api_keys
 */
const deepseek: ProviderPreset = {
  display_name: 'DeepSeek',
  base_url: 'https://api.deepseek.com/v1',
  api_key: '${DEEPSEEK_API_KEY}',
  protocol: 'openai',
  website: 'https://platform.deepseek.com/api_keys',
  models: [
    'deepseek-chat',
    'deepseek-reasoner',
  ],
};

/*
 * Mistral AI
 * API key page: https://console.mistral.ai/api-keys/
 */
const mistral: ProviderPreset = {
  display_name: 'Mistral AI',
  base_url: 'https://api.mistral.ai/v1',
  api_key: '${MISTRAL_API_KEY}',
  protocol: 'openai',
  website: 'https://console.mistral.ai/api-keys/',
  models: [
    'mistral-large-latest',
    'mistral-medium-latest',
    'mistral-small-latest',
    'pixtral-large-latest',
    'codestral-latest',
    'open-mistral-nemo',
  ],
};

/*
 * Cohere
 * API key page: https://dashboard.cohere.com/api-keys
 */
const cohere: ProviderPreset = {
  display_name: 'Cohere',
  base_url: 'https://api.cohere.ai/v1',
  api_key: '${COHERE_API_KEY}',
  protocol: 'openai',
  website: 'https://dashboard.cohere.com/api-keys',
  models: [
    'command-r-plus',
    'command-r',
    'command-a-v2',
    'command',
  ],
};

/*
 * xAI (Grok)
 * API key page: https://console.x.ai
 */
const xai: ProviderPreset = {
  display_name: 'xAI (Grok)',
  base_url: 'https://api.x.ai/v1',
  api_key: '${XAI_API_KEY}',
  protocol: 'openai',
  website: 'https://console.x.ai',
  models: [
    'grok-3',
    'grok-3-fast',
    'grok-2',
    'grok-2-vision',
  ],
};

/*
 * Perplexity
 * API key page: https://www.perplexity.ai/settings/api
 */
const perplexity: ProviderPreset = {
  display_name: 'Perplexity',
  base_url: 'https://api.perplexity.com',
  api_key: '${PERPLEXITY_API_KEY}',
  protocol: 'openai',
  website: 'https://www.perplexity.ai/settings/api',
  models: [
    'sonar-pro',
    'sonar',
    'sonar-reasoning',
    'sonar-deep-research',
  ],
};

/*
 * OpenRouter
 * API key page: https://openrouter.ai/keys
 */
const openrouter: ProviderPreset = {
  display_name: 'OpenRouter',
  base_url: 'https://openrouter.ai/api/v1',
  api_key: '${OPENROUTER_API_KEY}',
  protocol: 'openai',
  website: 'https://openrouter.ai/keys',
  models: [
    'openai/gpt-4o',
    'anthropic/claude-sonnet-4',
    'google/gemini-2.5-pro',
    'meta-llama/llama-4-maverick',
    'deepseek/deepseek-r1',
    'qwen/qwq-32b',
  ],
};

/*
 * Replicate
 * API key page: https://replicate.com/account/api-tokens
 */
const replicate: ProviderPreset = {
  display_name: 'Replicate',
  base_url: 'https://api.replicate.com/v1',
  api_key: '${REPLICATE_API_KEY}',
  protocol: 'openai',
  website: 'https://replicate.com/account/api-tokens',
  models: [
    'meta/meta-llama-3.1-405b-instruct',
    'mistralai/mixtral-8x7b-instruct-v0.1',
    'meta/llama-2-70b-chat',
    'deepseek-ai/deepseek-r1',
  ],
};

/*
 * Hyperbolic
 * API key page: https://app.hyperbolic.xyz/settings
 */
const hyperbolic: ProviderPreset = {
  display_name: 'Hyperbolic',
  base_url: 'https://api.hyperbolic.xyz/v1',
  api_key: '${HYPERBOLIC_API_KEY}',
  protocol: 'openai',
  website: 'https://app.hyperbolic.xyz/settings',
  models: [
    'deepseek-ai/DeepSeek-V3',
    'Qwen/Qwen2.5-72B-Instruct',
    'meta-llama/Llama-3.3-70B-Instruct',
    'deepseek-ai/DeepSeek-R1',
    'deepseek-ai/DeepSeek-V3-0324',
  ],
};

/*
 * Cerebras
 * API key page: https://cloud.cerebras.ai/apikeys
 */
const cerebras: ProviderPreset = {
  display_name: 'Cerebras',
  base_url: 'https://api.cerebras.ai/v1',
  api_key: '${CEREBRAS_API_KEY}',
  protocol: 'openai',
  website: 'https://cloud.cerebras.ai/apikeys',
  models: [
    'llama3.3-70b',
    'llama3.1-8b',
    'mixtral-8x7b',
    'llama-4-scout-17b-64e-instruct',
  ],
};

/*
 * Novita AI
 * API key page: https://novita.ai/dashboard/key
 */
const novita: ProviderPreset = {
  display_name: 'Novita AI',
  base_url: 'https://api.novita.ai/v3/openai',
  api_key: '${NOVITA_API_KEY}',
  protocol: 'openai',
  website: 'https://novita.ai/dashboard/key',
  models: [
    'meta-llama/llama-3.1-8b-instruct',
    'meta-llama/llama-3.1-70b-instruct',
    'mistralai/mistral-7b-instruct',
    'deepseek/deepseek-r1',
    'qwen/qwen-2.5-72b-instruct',
  ],
};

/*
 * NVIDIA NIM
 * API key page: https://build.nvidia.com/explore/discover
 */
const nvidia: ProviderPreset = {
  display_name: 'NVIDIA NIM',
  base_url: 'https://integrate.api.nvidia.com/v1',
  api_key: '${NVIDIA_API_KEY}',
  protocol: 'openai',
  website: 'https://build.nvidia.com/explore/discover',
  models: [
    'nvidia/llama-3.1-nemotron-70b-instruct',
    'meta/llama-3.3-70b-instruct',
    'nvidia/nemotron-4-340b-instruct',
    'mistralai/mixtral-8x22b-instruct-v0.1',
  ],
};

/*
 * GitHub Copilot
 * API key page: https://github.com/settings/tokens (with Copilot scope)
 */
const github: ProviderPreset = {
  display_name: 'GitHub Copilot',
  base_url: 'https://api.githubcopilot.com',
  api_key: '${GITHUB_COPILOT_API_KEY}',
  protocol: 'openai',
  website: 'https://github.com/settings/tokens',
  models: [
    'gpt-4o',
    'gpt-4o-mini',
    'o3-mini',
    'gpt-4.1',
    'claude-3.5-sonnet',
    'claude-sonnet-4',
    'gemini-2.5-pro',
  ],
};

// ---------------------------------------------------------------------------
// 中国市场 Providers (Chinese Market)
// ---------------------------------------------------------------------------

/*
 * 智谱AI (GLM) - Zhipu AI
 * API key page: https://open.bigmodel.cn/usercenter/apikeys
 */
const zhipu: ProviderPreset = {
  display_name: '智谱AI (GLM)',
  base_url: 'https://open.bigmodel.cn/api/paas/v4',
  api_key: '${ZHIPU_API_KEY}',
  protocol: 'openai',
  website: 'https://open.bigmodel.cn/usercenter/apikeys',
  models: [
    'glm-4-plus',
    'glm-4-flash',
    'glm-4-air',
    'glm-4-long',
    'glm-4v-plus',
    'glm-4',
  ],
};

/*
 * 通义千问 (Qwen / DashScope) - Alibaba Cloud
 * API key page: https://dashscope.console.aliyun.com/apiKey
 */
const qwen: ProviderPreset = {
  display_name: '通义千问 (DashScope)',
  base_url: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  api_key: '${QWEN_API_KEY}',
  protocol: 'openai',
  website: 'https://dashscope.console.aliyun.com/apiKey',
  models: [
    'qwen-max',
    'qwen-plus',
    'qwen-turbo',
    'qwen-vl-max',
    'qwen-coder-plus',
    'qwen3-235b-a22b',
  ],
};

/*
 * 月之暗面 (Moonshot / Kimi)
 * API key page: https://platform.moonshot.cn/console/api-keys
 */
const moonshot: ProviderPreset = {
  display_name: '月之暗面 (Kimi)',
  base_url: 'https://api.moonshot.cn/v1',
  api_key: '${MOONSHOT_API_KEY}',
  protocol: 'openai',
  website: 'https://platform.moonshot.cn/console/api-keys',
  models: [
    'moonshot-v1-8k',
    'moonshot-v1-32k',
    'moonshot-v1-128k',
    'kimi-latest',
  ],
};

/*
 * 百川智能 (Baichuan)
 * API key page: https://platform.baichuan-ai.com/console/apikey
 */
const baichuan: ProviderPreset = {
  display_name: '百川智能 (Baichuan)',
  base_url: 'https://api.baichuan-ai.com/v1',
  api_key: '${BAICHUAN_API_KEY}',
  protocol: 'openai',
  website: 'https://platform.baichuan-ai.com/console/apikey',
  models: [
    'Baichuan4-Turbo',
    'Baichuan4-Air',
    'Baichuan3-Turbo',
    'Baichuan4',
  ],
};

/*
 * 零一万物 (Yi / 01.AI)
 * API key page: https://platform.lingyiwanwu.com/apikey
 */
const yi: ProviderPreset = {
  display_name: '零一万物 (Yi)',
  base_url: 'https://api.lingyiwanwu.com/v1',
  api_key: '${YI_API_KEY}',
  protocol: 'openai',
  website: 'https://platform.lingyiwanwu.com/apikey',
  models: [
    'yi-large',
    'yi-medium',
    'yi-vision',
    'yi-lightning',
    'yi-large-turbo',
  ],
};

/*
 * MiniMax (海螺AI)
 * API key page: https://platform.minimax.chat/user-center/basic-information/interface-key
 */
const minimax: ProviderPreset = {
  display_name: 'MiniMax',
  base_url: 'https://api.minimax.chat/v1',
  api_key: '${MINIMAX_API_KEY}',
  protocol: 'openai',
  website: 'https://platform.minimax.chat/user-center/basic-information/interface-key',
  models: [
    'abab6.5s-chat',
    'abab6.5t-chat',
    'abab5.5-chat',
    'minimax-text-01',
  ],
};

/*
 * 火山引擎 (Volcano Ark / ByteDance / 豆包)
 * API key page: https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey
 */
const volcano: ProviderPreset = {
  display_name: '火山引擎 (豆包)',
  base_url: 'https://ark.cn-beijing.volces.com/api/v3',
  api_key: '${VOLCANO_API_KEY}',
  protocol: 'openai',
  website: 'https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey',
  models: [
    'doubao-pro-32k',
    'doubao-lite-32k',
    'doubao-pro-128k',
    'doubao-vision-pro-32k',
    'deepseek-r1-2501',
    'deepseek-v3-250324',
  ],
};

/*
 * 深度求索 (DeepSeek 中国站) - DeepSeek Chinese Platform
 * API key page: https://platform.deepseek.com/api_keys
 */
const deepseek_cn: ProviderPreset = {
  display_name: '深度求索 (DeepSeek)',
  base_url: 'https://api.deepseek.com/v1',
  api_key: '${DEEPSEEK_CN_API_KEY}',
  protocol: 'openai',
  website: 'https://platform.deepseek.com/api_keys',
  models: [
    'deepseek-chat',
    'deepseek-reasoner',
  ],
};

/*
 * 硅基流动 (SiliconFlow)
 * API key page: https://cloud.siliconflow.cn/account/ak
 */
const siliconflow: ProviderPreset = {
  display_name: '硅基流动 (SiliconFlow)',
  base_url: 'https://api.siliconflow.cn/v1',
  api_key: '${SILICONFLOW_API_KEY}',
  protocol: 'openai',
  website: 'https://cloud.siliconflow.cn/account/ak',
  models: [
    'deepseek-ai/DeepSeek-V3',
    'deepseek-ai/DeepSeek-R1',
    'Qwen/Qwen2.5-72B-Instruct',
    'THUDM/glm-4-9b-chat',
    'meta-llama/Llama-3.3-70B-Instruct',
    'Pro/Qwen/Qwen2.5-7B-Instruct',
  ],
};

/*
 * 讯飞星火 (iFlytek Spark)
 * API key page: https://console.xfyun.cn/services/bm4
 */
const spark: ProviderPreset = {
  display_name: '讯飞星火 (Spark)',
  base_url: 'https://spark-api-open.xf-yun.com/v1',
  api_key: '${SPARK_API_KEY}',
  protocol: 'openai',
  website: 'https://console.xfyun.cn/services/bm4',
  models: [
    'spark-4.0-ultra',
    'spark-max',
    'spark-pro',
    'spark-lite',
  ],
};

/*
 * 腾讯混元 (Tencent Hunyuan)
 * API key page: https://console.cloud.tencent.com/hunyuan/start
 */
const hunyuan: ProviderPreset = {
  display_name: '腾讯混元 (Hunyuan)',
  base_url: 'https://api.hunyuan.cloud.tencent.com/v1',
  api_key: '${HUNYUAN_API_KEY}',
  protocol: 'openai',
  website: 'https://console.cloud.tencent.com/hunyuan/start',
  models: [
    'hunyuan-pro',
    'hunyuan-standard',
    'hunyuan-turbo',
    'hunyuan-lite',
    'hunyuan-vision',
  ],
};

/*
 * 百度千帆 (Baidu Qianfan)
 * API key page: https://console.bce.baidu.com/qianfan/ais/console/applicationConsole/application
 */
const qianfan: ProviderPreset = {
  display_name: '百度千帆 (Qianfan)',
  base_url: 'https://qianfan.baidubce.com/v2',
  api_key: '${QIANFAN_API_KEY}',
  protocol: 'openai',
  website: 'https://console.bce.baidu.com/qianfan/ais/console/applicationConsole/application',
  models: [
    'ernie-4.5-8k',
    'ernie-4.0-8k',
    'ernie-3.5-8k',
    'ernie-speed-8k',
    'ernie-lite-8k',
    'deepseek-v3',
    'deepseek-r1',
  ],
};

// ---------------------------------------------------------------------------
// Anthropic-compatible Providers
// ---------------------------------------------------------------------------

/*
 * AWS Bedrock (Claude) - Anthropic protocol
 * Uses the Converse API with Anthropic-style messages format.
 * Key page: https://console.aws.amazon.com/iam/
 * Replace ${AWS_REGION} with your region (e.g., us-east-1).
 */
const bedrock: ProviderPreset = {
  display_name: 'AWS Bedrock (Claude)',
  base_url: 'https://bedrock-runtime.${AWS_REGION}.amazonaws.com',
  api_key: '${AWS_BEDROCK_API_KEY}',
  protocol: 'anthropic',
  website: 'https://console.aws.amazon.com/bedrock/',
  models: [
    'anthropic.claude-sonnet-4-20250514-v1:0',
    'anthropic.claude-opus-4-20250514-v1:0',
    'anthropic.claude-3.5-haiku-20241022-v1:0',
    'meta.llama4-maverick-17b-instruct-v1:0',
    'meta.llama4-scout-17b-instruct-v1:0',
  ],
};

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export const presets: Record<string, ProviderPreset> = {
  // International (OpenAI-compatible)
  openai,
  anthropic,
  google,
  groq,
  together,
  fireworks,
  deepseek,
  mistral,
  cohere,
  xai,
  perplexity,
  openrouter,
  replicate,
  hyperbolic,
  cerebras,
  novita,
  nvidia,
  github,

  // 中国市场 (Chinese Market)
  zhipu,
  qwen,
  moonshot,
  baichuan,
  yi,
  minimax,
  volcano,
  deepseek_cn,
  siliconflow,
  spark,
  hunyuan,
  qianfan,

  // Anthropic-compatible
  bedrock,
};
