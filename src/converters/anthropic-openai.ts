import type { Converter, StreamContext } from '../types.js';
import { createConverter } from './base.js';
import { formatSSE, safeJsonParse } from './helpers.js';

// ============================================================================
// Helpers
// ============================================================================

function thinkingBudgetToReasoningEffort(budgetTokens: number): string {
  if (budgetTokens <= 4000) return 'low';
  if (budgetTokens <= 16000) return 'medium';
  return 'high';
}

function reasoningEffortToBudget(effort: string): number {
  switch (effort) {
    case 'low': return 4000;
    case 'medium': return 16000;
    case 'high': return 32000;
    default: return 16000;
  }
}

function parseDataUri(dataUri: string): { mediaType: string; data: string } | null {
  const match = dataUri.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return { mediaType: match[1], data: match[2] };
}

function finishReasonToStopReason(finishReason: string): string {
  switch (finishReason) {
    case 'stop': return 'end_turn';
    case 'length': return 'max_tokens';
    case 'tool_calls': return 'tool_use';
    case 'content_filter': return 'end_turn';
    default: return 'end_turn';
  }
}

function stopReasonToFinishReason(stopReason: string): string {
  switch (stopReason) {
    case 'end_turn': return 'stop';
    case 'max_tokens': return 'length';
    case 'tool_use': return 'tool_calls';
    case 'stop_sequence': return 'stop';
    default: return 'stop';
  }
}

function convertAnthropicErrorToOpenAI(anthropicBody: string): string {
  try {
    const err = JSON.parse(anthropicBody);
    const anthropicType = err?.error?.type || '';
    let openaiType = 'server_error';
    if (anthropicType === 'permission_error' || anthropicType === 'authentication_error') {
      openaiType = 'invalid_request_error';
    } else if (anthropicType === 'invalid_request_error') {
      openaiType = 'invalid_request_error';
    } else if (anthropicType === 'not_found_error') {
      openaiType = 'invalid_request_error';
    } else if (anthropicType === 'rate_limit_error') {
      openaiType = 'rate_limit_error';
    } else if (anthropicType === 'api_error') {
      openaiType = 'server_error';
    } else if (anthropicType === 'overloaded_error') {
      openaiType = 'server_error';
    }
    return JSON.stringify({
      error: {
        message: err?.error?.message || 'Unknown error',
        type: openaiType,
        code: anthropicType || null,
      },
    });
  } catch {
    return JSON.stringify({
      error: { message: anthropicBody, type: 'server_error', code: null },
    });
  }
}

function convertOpenAIErrorToAnthropic(openAIBody: string): string {
  try {
    const err = JSON.parse(openAIBody);
    const openaiType = err?.error?.type || '';
    let anthropicType = 'api_error';
    if (openaiType === 'invalid_request_error') {
      anthropicType = 'invalid_request_error';
    } else if (openaiType === 'rate_limit_error' || openaiType === 'insufficient_quota') {
      anthropicType = 'rate_limit_error';
    } else if (openaiType === 'authentication_error') {
      anthropicType = 'authentication_error';
    } else if (openaiType === 'server_error') {
      anthropicType = 'api_error';
    }
    return JSON.stringify({
      type: 'error',
      error: { type: anthropicType, message: err?.error?.message || 'Unknown error' },
    });
  } catch {
    return JSON.stringify({
      type: 'error',
      error: { type: 'api_error', message: openAIBody },
    });
  }
}

// ============================================================================
// Anthropic → OpenAI Chat Converter
// ============================================================================

interface AnthropicContentBlock {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  content?: string | unknown[];
  source?: { type: string; media_type: string; data: string };
}

interface AnthropicTool {
  name: string;
  description?: string;
  input_schema: Record<string, unknown>;
}

interface AnthropicRequestMessage {
  role: string;
  content: string | AnthropicContentBlock[];
}

interface AnthropicRequest {
  model: string;
  messages: AnthropicRequestMessage[];
  system?: string | { type: string; text: string }[];
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  top_k?: number;
  stop_sequences?: string[];
  tools?: AnthropicTool[];
  tool_choice?: { type: string; name?: string };
  thinking?: { type: string; budget_tokens: number };
  stream?: boolean;
}

interface OpenAIRequestMessage {
  role: string;
  content?: string | unknown[] | null;
  name?: string;
  tool_calls?: OpenAIToolCall[];
  tool_call_id?: string;
}

interface OpenAIToolCall {
  id: string;
  type: string;
  function: { name: string; arguments: string };
}

interface OpenAITool {
  type: string;
  function: {
    name: string;
    description?: string;
    parameters: Record<string, unknown>;
  };
}

interface OpenAIRequest {
  model: string;
  messages: OpenAIRequestMessage[];
  max_completion_tokens?: number;
  temperature?: number;
  top_p?: number;
  stop?: string | string[];
  tools?: OpenAITool[];
  tool_choice?: string | { type: string; function: { name: string } };
  reasoning_effort?: string;
  stream?: boolean;
}

type OpenAIResponseChoice = {
  index: number;
  message: {
    role: string;
    content: string | null;
    tool_calls?: { id: string; type: string; function: { name: string; arguments: string } }[];
  };
  finish_reason: string;
};

type OpenAIResponse = {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: OpenAIResponseChoice[];
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
};

type AnthropicResponseContent =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> };

type AnthropicResponse = {
  id: string;
  type: string;
  role: string;
  model: string;
  content: AnthropicResponseContent[];
  stop_reason: string | null;
  stop_sequence: string | null;
  usage: { input_tokens: number; output_tokens: number };
};

// ---------------------------------------------------------------------------
// Stream state (Anthropic client ← proxy ← OpenAI upstream)
// ---------------------------------------------------------------------------

interface AnthropicStreamState {
  initialized: boolean;
  currentBlockIndex: number;
  currentBlockType: 'text' | 'tool_use' | null;
  toolCallInfo: Map<number, { id: string; name: string }>;
  messageId: string;
  model: string;
}

function createAnthropicStreamState(): AnthropicStreamState {
  return {
    initialized: false,
    currentBlockIndex: -1,
    currentBlockType: null,
    toolCallInfo: new Map(),
    messageId: '',
    model: '',
  };
}

export function createAnthropicToOpenAIStreamContext(): StreamContext {
  return { state: createAnthropicStreamState() as unknown as Record<string, unknown> };
}

function convertAnthropicRequestToOpenAI(body: Record<string, unknown>, targetModel: string): Record<string, unknown> {
  const req = body as unknown as AnthropicRequest;
  const openaiReq: Record<string, unknown> = {};
  const messages: OpenAIRequestMessage[] = [];

  // System prompt → first message with role "system"
  if (req.system) {
    let systemText = '';
    if (typeof req.system === 'string') {
      systemText = req.system;
    } else if (Array.isArray(req.system)) {
      systemText = req.system
        .filter((s) => s.type === 'text')
        .map((s) => s.text)
        .join('\n');
    }
    if (systemText) {
      messages.push({ role: 'system', content: systemText });
    }
  }

  // Convert messages
  for (const msg of req.messages) {
    const openaiMsg: OpenAIRequestMessage = { role: msg.role };

    if (typeof msg.content === 'string') {
      openaiMsg.content = msg.content;
    } else if (Array.isArray(msg.content)) {
      // Separate text blocks from tool blocks
      const textBlocks = msg.content.filter((c) => c.type === 'text');
      const toolUseBlocks = msg.content.filter((c) => c.type === 'tool_use');
      const toolResultBlocks = msg.content.filter((c) => c.type === 'tool_result');

      if (msg.role === 'assistant' && toolUseBlocks.length > 0 && textBlocks.length === 0) {
        // Tool use only → no content, just tool_calls
        openaiMsg.content = null;
        openaiMsg.tool_calls = toolUseBlocks.map((tb) => ({
          id: tb.id!,
          type: 'function',
          function: {
            name: tb.name!,
            arguments: JSON.stringify(tb.input || {}),
          },
        }));
      } else if (toolResultBlocks.length > 0) {
        // tool_result → role: "tool"
        // Each tool_result becomes its own tool message
        for (const tr of toolResultBlocks) {
          let content: string;
          if (typeof tr.content === 'string') {
            content = tr.content;
          } else if (Array.isArray(tr.content)) {
            content = (tr.content as AnthropicContentBlock[])
              .filter((c) => c.type === 'text')
              .map((c) => c.text)
              .join('\n');
          } else {
            content = '';
          }
          messages.push({
            role: 'tool',
            tool_call_id: tr.tool_use_id!,
            content,
          });
        }
        // Don't add the original content as a separate message — tool results are already broken out.
        // But if there are also text blocks in the same content array, they need a user message.
        if (textBlocks.length > 0) {
          messages.push({ role: 'user', content: textBlocks.map((c) => c.text).join('\n') });
        }
        // Skip adding the original message since we've split it into messages
        continue;
      } else if (textBlocks.length === 1 && textBlocks.length === msg.content.length) {
        // Single text block and no other block types → string content
        openaiMsg.content = textBlocks[0].text;
      } else {
        // Multiple blocks or mixed block types → array content
        const parts: unknown[] = [];
        for (const block of msg.content) {
          if (block.type === 'text') {
            parts.push({ type: 'text', text: block.text });
          } else if (block.type === 'image') {
            parts.push({
              type: 'image_url',
              image_url: { url: `data:${block.source!.media_type};base64,${block.source!.data}` },
            });
          }
        }
        openaiMsg.content = parts;
      }
    }

    messages.push(openaiMsg);
  }

  openaiReq.messages = messages;
  openaiReq.model = targetModel;

  // max_tokens → max_completion_tokens
  if (req.max_tokens !== undefined) {
    openaiReq.max_completion_tokens = req.max_tokens;
  }

  // Pass-through
  if (req.temperature !== undefined) openaiReq.temperature = req.temperature;
  if (req.top_p !== undefined) openaiReq.top_p = req.top_p;
  // top_k dropped

  // stop_sequences → stop
  if (req.stop_sequences) {
    openaiReq.stop = req.stop_sequences;
  }

  // Stream
  if (req.stream !== undefined) openaiReq.stream = req.stream;

  // Tools
  if (req.tools && req.tools.length > 0) {
    openaiReq.tools = req.tools.map((t) => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.input_schema,
      },
    }));
  }

  // tool_choice
  if (req.tool_choice) {
    if (req.tool_choice.type === 'auto') {
      openaiReq.tool_choice = 'auto';
    } else if (req.tool_choice.type === 'any') {
      openaiReq.tool_choice = 'required';
    } else if (req.tool_choice.type === 'tool' && req.tool_choice.name) {
      openaiReq.tool_choice = { type: 'function', function: { name: req.tool_choice.name } };
    }
  }

  // thinking → reasoning_effort
  if (req.thinking && req.thinking.type === 'enabled') {
    openaiReq.reasoning_effort = thinkingBudgetToReasoningEffort(req.thinking.budget_tokens);
  }

  return openaiReq;
}

function convertOpenAIResponseToAnthropic(body: Record<string, unknown>): Record<string, unknown> {
  const resp = body as unknown as OpenAIResponse;
  const choice = resp.choices?.[0];
  if (!choice) {
    return {
      id: resp.id || 'msg_unknown',
      type: 'message',
      role: 'assistant',
      model: resp.model,
      content: [{ type: 'text', text: '' }],
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: { input_tokens: 0, output_tokens: 0 },
    };
  }

  const content: AnthropicResponseContent[] = [];
  if (choice.message?.content) {
    content.push({ type: 'text', text: choice.message.content });
  }
  if (choice.message?.tool_calls) {
    for (const tc of choice.message.tool_calls) {
      let input: Record<string, unknown> = {};
      try {
        input = JSON.parse(tc.function.arguments);
      } catch {
        input = {};
      }
      content.push({ type: 'tool_use', id: tc.id, name: tc.function.name, input });
    }
  }

  return {
    id: resp.id,
    type: 'message',
    role: 'assistant',
    model: resp.model,
    content,
    stop_reason: finishReasonToStopReason(choice.finish_reason),
    stop_sequence: null,
    usage: {
      input_tokens: resp.usage?.prompt_tokens || 0,
      output_tokens: resp.usage?.completion_tokens || 0,
    },
  };
}

function convertOpenAIStreamChunkToAnthropic(chunk: string, ctx: StreamContext): string | null {
  const state = ctx.state as unknown as AnthropicStreamState;

  const trimmed = chunk.trim();
  if (!trimmed) return null;

  const isDone = trimmed === 'data: [DONE]';
  if (isDone) {
    const events: string[] = [];
    if (state.currentBlockType) {
      events.push(formatSSE('content_block_stop', JSON.stringify({
        type: 'content_block_stop',
        index: state.currentBlockIndex,
      })));
    }
    events.push(formatSSE('message_delta', JSON.stringify({
      type: 'message_delta',
      delta: { stop_reason: 'end_turn' },
      usage: { output_tokens: 0 },
    })));
    events.push(formatSSE('message_stop', JSON.stringify({ type: 'message_stop' })));
    Object.assign(ctx.state, createAnthropicStreamState());
    return events.join('');
  }

  let data: unknown;
  const dataMatch = trimmed.match(/^data:\s*(.+)$/);
  if (dataMatch) {
    data = safeJsonParse(dataMatch[1]);
  } else {
    return null;
  }

  const obj = data as Record<string, unknown>;
  const choices = obj.choices as Array<Record<string, unknown>> | undefined;
  if (!choices || choices.length === 0) return null;

  const delta = choices[0].delta as Record<string, unknown> | undefined;
  const finishReason = choices[0].finish_reason as string | undefined;
  const usage = obj.usage as Record<string, number> | undefined;

  if (!state.initialized) {
    state.messageId = (obj.id as string) || 'msg_unknown';
    state.model = (obj.model as string) || 'unknown';
  }

  const events: string[] = [];

  // Handle content delta
  if (delta?.content !== undefined && delta.content !== null) {
    const text = delta.content as string;
    if (!state.initialized) {
      events.push(formatSSE('message_start', JSON.stringify({
        type: 'message_start',
        message: {
          id: state.messageId,
          type: 'message',
          role: 'assistant',
          model: state.model,
          content: [],
        },
      })));
      state.initialized = true;
    }

    if (state.currentBlockType !== 'text') {
      // Close previous block if any
      if (state.currentBlockType) {
        events.push(formatSSE('content_block_stop', JSON.stringify({
          type: 'content_block_stop',
          index: state.currentBlockIndex,
        })));
      }
      // Start new text block
      state.currentBlockIndex++;
      state.currentBlockType = 'text';
      events.push(formatSSE('content_block_start', JSON.stringify({
        type: 'content_block_start',
        index: state.currentBlockIndex,
        content_block: { type: 'text', text: '' },
      })));
    }

    events.push(formatSSE('content_block_delta', JSON.stringify({
      type: 'content_block_delta',
      index: state.currentBlockIndex,
      delta: { type: 'text_delta', text },
    })));
  }

  // Handle tool_calls delta
  if (delta?.tool_calls) {
    const toolCalls = delta.tool_calls as Array<Record<string, unknown>>;
    if (!state.initialized) {
      events.push(formatSSE('message_start', JSON.stringify({
        type: 'message_start',
        message: {
          id: state.messageId,
          type: 'message',
          role: 'assistant',
          model: state.model,
          content: [],
        },
      })));
      state.initialized = true;
    }

    for (const tc of toolCalls) {
      const idx = tc.index as number;

      if (!state.toolCallInfo.has(idx)) {
        // New tool call
        if (state.currentBlockType) {
          events.push(formatSSE('content_block_stop', JSON.stringify({
            type: 'content_block_stop',
            index: state.currentBlockIndex,
          })));
        }
        state.currentBlockIndex++;
        state.currentBlockType = 'tool_use';
        const tcId = (tc.id as string) || '';
        const tcName = (tc.function as Record<string, unknown>)?.name as string || '';
        state.toolCallInfo.set(idx, { id: tcId, name: tcName });

        events.push(formatSSE('content_block_start', JSON.stringify({
          type: 'content_block_start',
          index: state.currentBlockIndex,
          content_block: { type: 'tool_use', id: tcId, name: tcName, input: {} },
        })));
      }

      const func = tc.function as Record<string, unknown> | undefined;
      if (func?.arguments) {
        events.push(formatSSE('content_block_delta', JSON.stringify({
          type: 'content_block_delta',
          index: state.currentBlockIndex,
          delta: { type: 'input_json_delta', partial_json: func.arguments },
        })));
      }
    }
  }

  // Handle finish_reason
  if (finishReason) {
    if (state.currentBlockType) {
      events.push(formatSSE('content_block_stop', JSON.stringify({
        type: 'content_block_stop',
        index: state.currentBlockIndex,
      })));
    }
    events.push(formatSSE('message_delta', JSON.stringify({
      type: 'message_delta',
      delta: {
        stop_reason: finishReasonToStopReason(finishReason),
        stop_sequence: null,
      },
      usage: {
        output_tokens: usage?.completion_tokens || 0,
      },
    })));
    events.push(formatSSE('message_stop', JSON.stringify({ type: 'message_stop' })));
    Object.assign(ctx.state, createAnthropicStreamState());
  }

  return events.length > 0 ? events.join('') : null;
}

// ============================================================================
// OpenAI Chat → Anthropic Converter
// ============================================================================

interface OpenAI2StreamState {
  initialized: boolean;
  messageId: string;
  model: string;
  currentToolCallId: string;
  currentToolCallName: string;
  currentToolCallIndex: number;
  usagePromptTokens: number;
  usageCompletionTokens: number;
}

function createOpenAI2StreamState(): OpenAI2StreamState {
  return {
    initialized: false,
    messageId: '',
    model: '',
    currentToolCallId: '',
    currentToolCallName: '',
    currentToolCallIndex: 0,
    usagePromptTokens: 0,
    usageCompletionTokens: 0,
  };
}

export function createOpenAIToAnthropicStreamContext(): StreamContext {
  return { state: createOpenAI2StreamState() as unknown as Record<string, unknown> };
}

function convertOpenAIRequestToAnthropic(body: Record<string, unknown>, targetModel: string): Record<string, unknown> {
  const req = body as unknown as OpenAIRequest;
  const anthropicReq: Record<string, unknown> = {};

  anthropicReq.model = targetModel;
  const messages: AnthropicRequestMessage[] = [];

  // Extract system message(s)
  const systemBlocks: { type: string; text: string }[] = [];

  for (const msg of req.messages) {
    if (msg.role === 'system') {
      const content = msg.content;
      if (typeof content === 'string') {
        systemBlocks.push({ type: 'text', text: content });
      } else if (Array.isArray(content)) {
        for (const part of content) {
          const p = part as Record<string, unknown>;
          if (p.type === 'text') {
            systemBlocks.push({ type: 'text', text: p.text as string });
          }
        }
      }
    } else {
      // Convert content
      let anthropicContent: string | AnthropicContentBlock[];
      let anthropicRole = msg.role;

      if (msg.content === null || msg.content === undefined) {
        // Tool_calls will be added later in the dedicated block below
        anthropicContent = [];
      } else if (typeof msg.content === 'string') {
        anthropicContent = [{ type: 'text', text: msg.content }];
      } else if (Array.isArray(msg.content)) {
        const blocks: AnthropicContentBlock[] = [];
        for (const part of msg.content) {
          const p = part as Record<string, unknown>;
          if (p.type === 'text') {
            blocks.push({ type: 'text', text: p.text as string });
          } else if (p.type === 'image_url') {
            const imageUrl = p.image_url as Record<string, string>;
            const parsed = parseDataUri(imageUrl.url);
            if (parsed) {
              blocks.push({
                type: 'image',
                source: { type: 'base64', media_type: parsed.mediaType, data: parsed.data },
              });
            }
          }
        }
        anthropicContent = blocks;
      } else {
        anthropicContent = [{ type: 'text', text: '' }];
      }

      // Handle tool_calls on assistant message
      if (msg.tool_calls && msg.tool_calls.length > 0) {
        const contentBlocks: AnthropicContentBlock[] = [];
        if (Array.isArray(anthropicContent)) {
          contentBlocks.push(...anthropicContent);
        }
        for (const tc of msg.tool_calls) {
          contentBlocks.push({
            type: 'tool_use',
            id: tc.id,
            name: tc.function.name,
            input: safeParseJsonOrDefault(tc.function.arguments),
          });
        }
        anthropicContent = contentBlocks;
      }

      // Handle tool role → user with tool_result
      if (msg.role === 'tool') {
        anthropicRole = 'user';
        anthropicContent = [
          {
            type: 'tool_result',
            tool_use_id: msg.tool_call_id || '',
            content: typeof anthropicContent === 'string'
              ? anthropicContent
              : (Array.isArray(anthropicContent) && anthropicContent.length === 1 && anthropicContent[0].type === 'text')
                ? anthropicContent[0].text || ''
                : JSON.stringify(anthropicContent),
          },
        ];
      }

      messages.push({ role: anthropicRole, content: anthropicContent } as AnthropicRequestMessage);
    }
  }

  // Set system
  if (systemBlocks.length > 0) {
    anthropicReq.system = systemBlocks;
  }

  anthropicReq.messages = messages;

  // max_completion_tokens → max_tokens
  if (req.max_completion_tokens !== undefined) {
    anthropicReq.max_tokens = req.max_completion_tokens;
  }

  // Pass-through
  if (req.temperature !== undefined) anthropicReq.temperature = req.temperature;
  if (req.top_p !== undefined) anthropicReq.top_p = req.top_p;

  // stop → stop_sequences
  if (req.stop) {
    if (Array.isArray(req.stop)) {
      anthropicReq.stop_sequences = req.stop;
    } else {
      anthropicReq.stop_sequences = [req.stop];
    }
  }

  // Stream
  if (req.stream !== undefined) anthropicReq.stream = req.stream;

  // Tools
  if (req.tools && req.tools.length > 0) {
    anthropicReq.tools = req.tools.map((t) => ({
      name: t.function.name,
      description: t.function.description,
      input_schema: t.function.parameters,
    }));
  }

  // tool_choice
  if (req.tool_choice !== undefined) {
    if (req.tool_choice === 'auto') {
      anthropicReq.tool_choice = { type: 'auto' };
    } else if (req.tool_choice === 'required') {
      anthropicReq.tool_choice = { type: 'any' };
    } else if (req.tool_choice === 'none') {
      // Anthropic doesn't have "none" — just omit tools
      delete anthropicReq.tools;
    } else if (typeof req.tool_choice === 'object' && req.tool_choice.type === 'function') {
      anthropicReq.tool_choice = { type: 'tool', name: req.tool_choice.function.name };
    }
  }

  // reasoning_effort → thinking
  if (req.reasoning_effort) {
    anthropicReq.thinking = {
      type: 'enabled',
      budget_tokens: reasoningEffortToBudget(req.reasoning_effort),
    };
  }

  return anthropicReq;
}

function safeParseJsonOrDefault(json: string): Record<string, unknown> {
  try {
    return JSON.parse(json);
  } catch {
    return {};
  }
}

function convertAnthropicResponseToOpenAI(body: Record<string, unknown>): Record<string, unknown> {
  const resp = body as unknown as AnthropicResponse;
  const content = resp.content || [];

  const textContent = content
    .filter((c) => c.type === 'text')
    .map((c) => c.text)
    .join('');

  const toolCalls = content
    .filter((c) => c.type === 'tool_use')
    .map((c) => ({
      id: c.id,
      type: 'function',
      function: { name: c.name, arguments: JSON.stringify(c.input) },
    }));

  return {
    id: resp.id,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: resp.model,
    choices: [{
      index: 0,
      message: {
        role: 'assistant',
        content: textContent || null,
        ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
      },
      finish_reason: stopReasonToFinishReason(resp.stop_reason || 'end_turn'),
    }],
    usage: {
      prompt_tokens: resp.usage?.input_tokens || 0,
      completion_tokens: resp.usage?.output_tokens || 0,
      total_tokens: (resp.usage?.input_tokens || 0) + (resp.usage?.output_tokens || 0),
    },
  };
}

function convertAnthropicStreamChunkToOpenAI(chunk: string, ctx: StreamContext): string | null {
  const state = ctx.state as unknown as OpenAI2StreamState;

  const trimmed = chunk.trim();
  if (!trimmed) return null;

  // Parse the SSE event
  let eventType = '';
  let dataStr = '';

  const lines = trimmed.split('\n');
  for (const line of lines) {
    if (line.startsWith('event: ')) {
      eventType = line.slice(7).trim();
    } else if (line.startsWith('data: ')) {
      dataStr = line.slice(6);
    }
  }

  if (!dataStr) return null;

  // Error events
  if (eventType === 'error') {
    const err = safeJsonParse(dataStr) as Record<string, unknown>;
    return formatSSE('', JSON.stringify({
      error: err.error || err,
    }));
  }

  const data = safeJsonParse(dataStr) as Record<string, unknown>;
  const type = data.type as string;

  if (type === 'message_start') {
    const msg = data.message as Record<string, unknown>;
    state.initialized = true;
    state.messageId = (msg.id as string) || 'chatcmpl-unknown';
    state.model = (msg.model as string) || 'unknown';
    state.usagePromptTokens = ((msg.usage as Record<string, number>)?.input_tokens) || 0;

    return formatSSE('', JSON.stringify({
      id: state.messageId,
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model: state.model,
      choices: [{ index: 0, delta: { role: 'assistant', content: '' }, finish_reason: null }],
    }));
  }

  if (type === 'content_block_start') {
    const contentBlock = data.content_block as Record<string, unknown>;
    const blockType = contentBlock.type as string;
    const index = data.index as number;

    if (blockType === 'text') {
      return formatSSE('', JSON.stringify({
        id: state.messageId,
        object: 'chat.completion.chunk',
        created: Math.floor(Date.now() / 1000),
        model: state.model,
        choices: [{ index: 0, delta: { content: '' }, finish_reason: null }],
      }));
    } else if (blockType === 'tool_use') {
      state.currentToolCallId = (contentBlock.id as string) || '';
      state.currentToolCallName = (contentBlock.name as string) || '';
      state.currentToolCallIndex = index;

      return formatSSE('', JSON.stringify({
        id: state.messageId,
        object: 'chat.completion.chunk',
        created: Math.floor(Date.now() / 1000),
        model: state.model,
        choices: [{
          index: 0,
          delta: {
            tool_calls: [{
              index,
              id: state.currentToolCallId,
              type: 'function',
              function: { name: state.currentToolCallName, arguments: '' },
            }],
          },
          finish_reason: null,
        }],
      }));
    }
  }

  if (type === 'content_block_delta') {
    const delta = data.delta as Record<string, unknown>;
    const deltaType = delta.type as string;
    const index = data.index as number;

    if (deltaType === 'text_delta') {
      return formatSSE('', JSON.stringify({
        id: state.messageId,
        object: 'chat.completion.chunk',
        created: Math.floor(Date.now() / 1000),
        model: state.model,
        choices: [{ index: 0, delta: { content: delta.text as string }, finish_reason: null }],
      }));
    } else if (deltaType === 'input_json_delta') {
      return formatSSE('', JSON.stringify({
        id: state.messageId,
        object: 'chat.completion.chunk',
        created: Math.floor(Date.now() / 1000),
        model: state.model,
        choices: [{
          index: 0,
          delta: {
            tool_calls: [{
              index,
              function: { arguments: delta.partial_json as string },
            }],
          },
          finish_reason: null,
        }],
      }));
    }
  }

  if (type === 'content_block_stop') {
    return null; // No direct OpenAI equivalent
  }

  if (type === 'message_delta') {
    const delta = data.delta as Record<string, unknown>;
    const usage = data.usage as Record<string, number>;
    state.usageCompletionTokens = usage?.output_tokens || 0;

    const stopReason = delta.stop_reason as string || 'end_turn';

    return formatSSE('', JSON.stringify({
      id: state.messageId,
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model: state.model,
      choices: [{
        index: 0,
        delta: {},
        finish_reason: stopReasonToFinishReason(stopReason),
      }],
      usage: usage ? {
        prompt_tokens: state.usagePromptTokens,
        completion_tokens: usage.output_tokens,
        total_tokens: state.usagePromptTokens + usage.output_tokens,
      } : undefined,
    }));
  }

  if (type === 'message_stop') {
    Object.assign(ctx.state, createOpenAI2StreamState());
    return 'data: [DONE]\n\n';
  }

  if (type === 'ping') {
    return null;
  }

  return null;
}

// ============================================================================
// Exported converters
// ============================================================================

export const AnthropicToOpenAIChatConverter: Converter = createConverter(
  'anthropic',
  'openai',
  {
    convertRequest(body: Record<string, unknown>, targetModel: string): Record<string, unknown> {
      return convertAnthropicRequestToOpenAI(body, targetModel);
    },

    convertResponse(body: Record<string, unknown>): Record<string, unknown> {
      return convertOpenAIResponseToAnthropic(body);
    },

    convertStreamChunk(chunk: string, ctx: StreamContext): string | null {
      return convertOpenAIStreamChunkToAnthropic(chunk, ctx);
    },

    convertError(status: number, body: string): { status: number; body: string } {
      return { status, body: convertAnthropicErrorToOpenAI(body) };
    },

    createStreamContext(): StreamContext {
      return createAnthropicToOpenAIStreamContext();
    },
  },
);

export const OpenAIChatToAnthropicConverter: Converter = createConverter(
  'openai',
  'anthropic',
  {
    convertRequest(body: Record<string, unknown>, targetModel: string): Record<string, unknown> {
      return convertOpenAIRequestToAnthropic(body, targetModel);
    },

    convertResponse(body: Record<string, unknown>): Record<string, unknown> {
      return convertAnthropicResponseToOpenAI(body);
    },

    convertStreamChunk(chunk: string, ctx: StreamContext): string | null {
      return convertAnthropicStreamChunkToOpenAI(chunk, ctx);
    },

    convertError(status: number, body: string): { status: number; body: string } {
      return { status, body: convertOpenAIErrorToAnthropic(body) };
    },

    createStreamContext(): StreamContext {
      return createOpenAIToAnthropicStreamContext();
    },
  },
);
