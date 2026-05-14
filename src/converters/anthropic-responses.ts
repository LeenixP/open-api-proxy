import type { Converter, StreamContext } from '../types.js';
import { parseSSELine, parseSSEChunk, formatSSE, isDoneChunk, safeJsonParse } from './helpers.js';

// ──────────────────────────────────────
// Helper types
// ──────────────────────────────────────

interface ImageBlock {
  type: 'image';
  source: { type: 'base64' | 'url'; media_type?: string; data?: string; url?: string };
}

interface AnthropicContentBlock {
  type: string;
  text?: string;
  thinking?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  content?: string | Array<{ type: string; text?: string }>;
  [key: string]: unknown;
}

interface ResponsesInputItem {
  role: string;
  content: ResponsesContentPart[];
}

interface ResponsesContentPart {
  type: string;
  text?: string;
  annotations?: unknown[];
  id?: string;
  call_id?: string;
  name?: string;
  arguments?: string;
  output?: string;
  source?: { type: string; data?: string; url?: string; media_type?: string };
  summary?: Array<{ type: string; text: string }>;
  [key: string]: unknown;
}

interface ResponsesOutputItem {
  type: string;
  id?: string;
  role?: string;
  status?: string;
  content?: ResponsesContentPart[];
  call_id?: string;
  name?: string;
  arguments?: string;
  output?: string;
  summary?: Array<{ type: string; text: string }>;
  [key: string]: unknown;
}

// ──────────────────────────────────────
// Anthropic → OpenAI Responses
// ──────────────────────────────────────

class AnthropicToResponsesConverter implements Converter {
  readonly fromProtocol = 'anthropic';
  readonly toProtocol = 'openai-responses';

  createStreamContext(): StreamContext {
    return {
      state: {},
      responseId: '',
      itemId: '',
      outputIndex: 0,
      model: '',
      accumContent: [] as unknown[],
    };
  }

  convertRequest(body: Record<string, unknown>, targetModel: string): Record<string, unknown> {
    const result: Record<string, unknown> = { model: targetModel };

    if (body.max_tokens !== undefined) {
      result.max_output_tokens = body.max_tokens;
    }

    // system → instructions
    if (body.system !== undefined) {
      result.instructions = this.convertSystem(body.system);
    }

    // messages → input[]
    if (Array.isArray(body.messages)) {
      result.input = (body.messages as Array<Record<string, unknown>>).map((msg) =>
        this.convertMessage(msg),
      );
    }

    // tools → tools (function format)
    if (Array.isArray(body.tools)) {
      result.tools = (body.tools as Array<Record<string, unknown>>).map((tool) => ({
        type: 'function',
        name: tool.name,
        description: tool.description,
        parameters: tool.input_schema,
      }));
    }

    // thinking → reasoning
    if (body.thinking !== undefined) {
      result.reasoning = this.convertThinking(body.thinking);
    }

    // tool_choice
    if (body.tool_choice !== undefined) {
      result.tool_choice = this.convertToolChoice(body.tool_choice);
    }

    // stop_sequences (best-effort)
    if (Array.isArray(body.stop_sequences)) {
      result.stop_sequences = body.stop_sequences;
    }

    // pass-through scalar params
    for (const key of ['temperature', 'top_p', 'top_k', 'stream', 'metadata']) {
      if (body[key] !== undefined) {
        result[key] = body[key];
      }
    }

    return result;
  }

  convertResponse(body: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {
      id: body.id || '',
      type: 'message',
      role: 'assistant',
      model: body.model || '',
      content: [],
      stop_reason: 'end_turn',
      stop_sequence: null,
    };

    if (Array.isArray(body.output)) {
      for (const item of body.output as ResponsesOutputItem[]) {
        const converted = this.convertOutputItem(item);
        if (converted !== null && converted !== undefined) {
          if (Array.isArray(converted)) {
            (result.content as unknown[]).push(...converted);
          } else {
            (result.content as unknown[]).push(converted);
          }
        }
      }
    }

    if (body.usage) {
      result.usage = body.usage;
    }

    if (body.status === 'completed') {
      result.stop_reason = 'end_turn';
    } else if (body.status === 'failed' || body.error) {
      result.stop_reason = 'error';
    }

    return result;
  }

  convertStreamChunk(chunk: string, ctx: StreamContext): string | null {
    if (isDoneChunk(chunk)) return 'data: [DONE]\n\n';

    const parsed = parseSSEChunk(chunk);
    if (!parsed) return null;

    const event = safeJsonParse(parsed.data) as Record<string, unknown>;
    if (!event || typeof event !== 'object' || !event.type) return null;

    const type = event.type as string;

    switch (type) {
      case 'message_start':
        return this.onMessageStart(event, ctx);
      case 'content_block_start':
        return this.onContentBlockStart(event, ctx);
      case 'content_block_delta':
        return this.onContentBlockDelta(event, ctx);
      case 'content_block_stop':
        return chunk; // forward as-is
      case 'message_delta':
        return this.onMessageDelta(event, ctx);
      case 'message_stop':
        return 'data: [DONE]\n\n';
      case 'error':
        return chunk; // forward errors
      default:
        return null;
    }
  }

  convertError(status: number, body: string): { status: number; body: string } {
    const parsed = safeJsonParse(body) as Record<string, unknown>;
    if (!parsed || !parsed.error) return { status, body };

    const error = parsed.error as Record<string, unknown>;
    const errorType = (error.type as string) || 'api_error';

    // Map Anthropic error types → Responses error types
    const typeMap: Record<string, string> = {
      invalid_request_error: 'invalid_request_error',
      authentication_error: 'authentication_error',
      permission_error: 'permission_error',
      not_found_error: 'not_found_error',
      rate_limit_error: 'rate_limit_error',
      api_error: 'api_error',
      overloaded_error: 'server_error',
    };

    return {
      status: this.mapErrorStatus(status),
      body: JSON.stringify({
        type: 'error',
        error: {
          type: typeMap[errorType] || errorType,
          message: error.message || 'An error occurred',
        },
      }),
    };
  }

  // ── private helpers ──

  private convertSystem(system: unknown): string {
    if (typeof system === 'string') return system;
    if (Array.isArray(system)) {
      return (system as Array<{ type: string; text: string }>)
        .filter((b) => b.type === 'text')
        .map((b) => b.text)
        .join('\n');
    }
    return String(system);
  }

  private convertMessage(msg: Record<string, unknown>): ResponsesInputItem {
    const role = msg.role as string;
    const rawContent = msg.content;
    const content: AnthropicContentBlock[] = Array.isArray(rawContent)
      ? (rawContent as AnthropicContentBlock[])
      : typeof rawContent === 'string'
        ? [{ type: 'text', text: rawContent }]
        : [rawContent as AnthropicContentBlock];

    if (role === 'user') {
      return {
        role: 'user',
        content: content.map((block) => {
          switch (block.type) {
            case 'text':
              return { type: 'input_text', text: block.text || '' };
            case 'image':
              return this.convertImageBlock(block as unknown as ImageBlock);
            case 'tool_result':
              return {
                type: 'function_call_output',
                call_id: block.tool_use_id || '',
                output:
                  typeof block.content === 'string'
                    ? block.content
                    : JSON.stringify(block.content),
              };
            default:
              return block as unknown as ResponsesContentPart;
          }
        }),
      };
    }

    // assistant role
    return {
      role: 'assistant',
      content: content.map((block) => {
        switch (block.type) {
          case 'text':
            return { type: 'output_text', text: block.text || '', annotations: [] };
          case 'tool_use':
            return {
              type: 'function_call',
              id: block.id || '',
              call_id: block.id || '',
              name: block.name || '',
              arguments: JSON.stringify(block.input || {}),
            };
          case 'thinking':
            return {
              type: 'reasoning',
              id: `rs_${Date.now()}`,
              summary: [{ type: 'summary_text', text: block.thinking || '' }],
            };
          default:
            return block as unknown as ResponsesContentPart;
        }
      }),
    };
  }

  private convertImageBlock(block: ImageBlock): ResponsesContentPart {
    if (block.source.type === 'url') {
      return { type: 'input_image', source: block.source };
    }
    // base64
    return {
      type: 'input_image',
      source: {
        type: 'base64',
        media_type: block.source.media_type || 'image/jpeg',
        data: block.source.data || '',
      },
    };
  }

  private convertThinking(thinking: unknown): Record<string, unknown> {
    const t = thinking as Record<string, unknown>;

    if (t.budget_tokens !== undefined) {
      const budget = t.budget_tokens as number;
      let effort = 'medium';
      if (budget < 800) effort = 'low';
      else if (budget >= 4000) effort = 'high';
      return { effort, summary: 'auto' };
    }

    // Fallback
    return { effort: 'medium', summary: 'auto' };
  }

  private convertToolChoice(toolChoice: unknown): unknown {
    const tc = toolChoice as Record<string, unknown>;
    const tcType = tc.type as string;

    if (tcType === 'auto') return 'auto';
    if (tcType === 'any') return 'required';
    if (tcType === 'tool' && tc.name) {
      return { type: 'function', name: tc.name };
    }

    return 'auto';
  }

  private convertOutputItem(item: ResponsesOutputItem): unknown {
    switch (item.type) {
      case 'message': {
        // Flatten message content into Anthropic content blocks
        const blocks: unknown[] = [];
        if (Array.isArray(item.content)) {
          for (const part of item.content) {
            const mapped = this.convertOutputPart(part);
            if (mapped) blocks.push(mapped);
          }
        }
        // Return flat array; caller will spread it
        return blocks;
      }
      case 'function_call':
        return {
          type: 'tool_use',
          id: item.call_id || item.id || '',
          name: item.name || '',
          input: safeJsonParse(item.arguments || '{}'),
        };
      case 'reasoning': {
        const sumText = Array.isArray(item.summary)
          ? item.summary.map((s) => s.text || '').join('\n')
          : '';
        return { type: 'thinking', thinking: sumText };
      }
      default:
        return null;
    }
  }

  private convertOutputPart(part: ResponsesContentPart): unknown {
    switch (part.type) {
      case 'output_text':
        return { type: 'text', text: part.text || '' };
      case 'function_call':
        return {
          type: 'tool_use',
          id: part.call_id || part.id || '',
          name: part.name || '',
          input: safeJsonParse(part.arguments || '{}'),
        };
      case 'reasoning': {
        const summaryText = Array.isArray(part.summary)
          ? part.summary.map((s) => s.text || '').join('\n')
          : '';
        return { type: 'thinking', thinking: summaryText };
      }
      default:
        return null;
    }
  }

  private mapErrorStatus(status: number): number {
    if (status === 429) return 429;
    if (status === 401 || status === 403) return status;
    if (status >= 500) return status;
    return status;
  }

  // ── stream event handlers ──

  private onMessageStart(event: Record<string, unknown>, ctx: StreamContext): string {
    const msg = event.message as Record<string, unknown>;
    ctx.responseId = `resp_${msg.id || Date.now()}`;
    ctx.itemId = `msg_${msg.id || Date.now()}`;
    ctx.outputIndex = 0;
    ctx.model = (msg.model as string) || '';
    ctx.accumContent = [] as unknown[];

    const created = {
      type: 'response.created',
      response: {
        id: ctx.responseId,
        object: 'response',
        model: ctx.model,
        status: 'in_progress',
        output: [],
        usage: msg.usage || null,
      },
    };

    const itemAdded = {
      type: 'response.output_item.added',
      output_index: ctx.outputIndex,
      item: {
        type: 'message',
        id: ctx.itemId,
        status: 'in_progress',
        role: 'assistant',
        content: [],
      },
    };

    return (
      formatSSE('response.created', JSON.stringify(created)) +
      formatSSE('response.output_item.added', JSON.stringify(itemAdded))
    );
  }

  private onContentBlockStart(event: Record<string, unknown>, ctx: StreamContext): string | null {
    const block = event.content_block as Record<string, unknown>;
    const blockType = block.type as string;
    const idx = event.index as number;

    if (blockType === 'text') {
      const part = {
        type: 'response.content_part.added',
        item_id: ctx.itemId,
        output_index: ctx.outputIndex,
        content_index: idx,
        part: {
          type: 'output_text',
          text: '',
          annotations: [],
        },
      };
      // Track the content block
      (ctx.accumContent as unknown[]).push({ type: 'text', text: '' });
      return formatSSE('response.content_part.added', JSON.stringify(part));
    }

    if (blockType === 'tool_use') {
      ctx.outputIndex = (ctx.outputIndex as number) + 1;
      const toolId = (block.id as string) || `tool_${idx}`;
      const item = {
        type: 'response.output_item.added',
        output_index: ctx.outputIndex,
        item: {
          type: 'function_call',
          id: toolId,
          call_id: block.id || toolId,
          name: block.name || '',
          arguments: '',
          status: 'in_progress',
        },
      };
      (ctx.accumContent as unknown[]).push({
        type: 'tool_use',
        id: block.id,
        name: block.name,
        input: '',
      });
      return formatSSE('response.output_item.added', JSON.stringify(item));
    }

    if (blockType === 'thinking') {
      // Map thinking blocks to a reasoning output item
      ctx.outputIndex = (ctx.outputIndex as number) + 1;
      const rsItem = {
        type: 'response.output_item.added',
        output_index: ctx.outputIndex,
        item: {
          type: 'reasoning',
          id: `rs_${idx}`,
          summary: [],
          status: 'in_progress',
        },
      };
      return formatSSE('response.output_item.added', JSON.stringify(rsItem));
    }

    return null;
  }

  private onContentBlockDelta(event: Record<string, unknown>, ctx: StreamContext): string | null {
    const delta = event.delta as Record<string, unknown>;
    const deltaType = delta.type as string;
    const idx = event.index as number;

    if (deltaType === 'text_delta') {
      const text = (delta.text as string) || '';
      const textDelta = {
        type: 'response.text.delta',
        item_id: ctx.itemId,
        output_index: ctx.outputIndex,
        content_index: idx,
        delta: text,
      };
      // Update accumulated content
      const accum = ctx.accumContent as unknown[];
      if (accum[idx] && (accum[idx] as Record<string, unknown>).type === 'text') {
        (accum[idx] as Record<string, unknown>).text += text;
      }
      return formatSSE('response.text.delta', JSON.stringify(textDelta));
    }

    if (deltaType === 'input_json_delta') {
      const partial = (delta.partial_json as string) || '';
      const argsDelta = {
        type: 'response.function_call_arguments.delta',
        item_id: ctx.itemId,
        output_index: ctx.outputIndex,
        delta: partial,
      };
      return formatSSE('response.function_call_arguments.delta', JSON.stringify(argsDelta));
    }

    if (deltaType === 'thinking_delta') {
      return formatSSE('response.reasoning_summary_part.added', JSON.stringify({
        type: 'response.reasoning_summary_part.added',
        item_id: `rs_${idx}`,
        output_index: ctx.outputIndex,
        part: { type: 'summary_text', text: delta.thinking || '' },
      }));
    }

    return null;
  }

  private onMessageDelta(event: Record<string, unknown>, ctx: StreamContext): string {
    const accumContent = ctx.accumContent as unknown[];
    const mapper = (c: unknown) => {
      const block = c as Record<string, unknown>;
      if (block.type === 'text') {
        return { type: 'output_text', text: block.text, annotations: [] };
      }
      if (block.type === 'tool_use') {
        return {
          type: 'function_call',
          id: block.id,
          call_id: block.id,
          name: block.name,
          arguments: typeof block.input === 'string' ? block.input : JSON.stringify(block.input || {}),
        };
      }
      return c;
    };

    const done = {
      type: 'response.output_item.done',
      output_index: ctx.outputIndex,
      item: {
        type: 'message',
        id: ctx.itemId,
        status: 'completed',
        role: 'assistant',
        content: accumContent.map(mapper),
      },
    };

    const usage = (event.usage as Record<string, unknown>) || {};
    const completed = {
      type: 'response.completed',
      response: {
        id: ctx.responseId,
        object: 'response',
        model: ctx.model,
        status: 'completed',
        output: [
          {
            type: 'message',
            id: ctx.itemId,
            role: 'assistant',
            status: 'completed',
            content: accumContent.map(mapper),
          },
        ],
        usage,
      },
    };

    return (
      formatSSE('response.output_item.done', JSON.stringify(done)) +
      formatSSE('response.completed', JSON.stringify(completed))
    );
  }
}

// ──────────────────────────────────────
// OpenAI Responses → Anthropic
// ──────────────────────────────────────

class ResponsesToAnthropicConverter implements Converter {
  readonly fromProtocol = 'openai-responses';
  readonly toProtocol = 'anthropic';

  createStreamContext(): StreamContext {
    return {
      state: {},
      messageId: '',
      model: '',
      roles: new Map<number, string>(),
      contentTypes: new Map<string, string>(),
    };
  }

  convertRequest(body: Record<string, unknown>, targetModel: string): Record<string, unknown> {
    const result: Record<string, unknown> = { model: targetModel };

    // max_output_tokens → max_tokens
    if (body.max_output_tokens !== undefined) {
      result.max_tokens = body.max_output_tokens;
    }

    // instructions → system
    if (body.instructions !== undefined) {
      result.system = [
        { type: 'text', text: String(body.instructions), cache_control: null },
      ];
    }

    // input[] → messages
    if (Array.isArray(body.input)) {
      result.messages = (body.input as Array<Record<string, unknown>>).map(
        (item) => this.convertInputItem(item),
      );
    }

    // tools → tools (Anthropic format)
    if (Array.isArray(body.tools)) {
      result.tools = (body.tools as Array<Record<string, unknown>>).map((tool) => ({
        name: tool.name,
        description: tool.description,
        input_schema: tool.parameters,
      }));
    }

    // reasoning → thinking
    if (body.reasoning) {
      result.thinking = this.convertReasoning(body.reasoning);
    }

    // tool_choice
    if (body.tool_choice !== undefined) {
      result.tool_choice = this.convertToolChoice(body.tool_choice);
    }

    // stop_sequences
    if (Array.isArray(body.stop_sequences)) {
      result.stop_sequences = body.stop_sequences;
    }

    // pass-through scalar params
    for (const key of ['temperature', 'top_p', 'stream', 'metadata']) {
      if (body[key] !== undefined) {
        result[key] = body[key];
      }
    }

    return result;
  }

  convertResponse(body: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {
      id: body.id || '',
      object: 'response',
      model: body.model || '',
      status: 'completed',
      output: [],
    };

    if (Array.isArray(body.content)) {
      const msgOutput: ResponsesOutputItem = {
        type: 'message',
        id: (body.id as string) || 'msg_default',
        role: (body.role as string) || 'assistant',
        status: 'completed',
        content: [],
      };

      for (const block of body.content as Array<Record<string, unknown>>) {
        const part = this.convertAnthropicBlock(block);
        if (part) {
          (msgOutput.content as ResponsesContentPart[]).push(part);
        }
      }

      (result.output as ResponsesOutputItem[]).push(msgOutput);
    }

    // Determine status from stop_reason
    if (body.stop_reason === 'error') {
      result.status = 'failed';
    }

    if (body.usage) {
      result.usage = body.usage;
    }

    return result;
  }

  convertStreamChunk(chunk: string, ctx: StreamContext): string | null {
    if (isDoneChunk(chunk)) return 'data: [DONE]\n\n';

    const parsed = parseSSEChunk(chunk);
    if (!parsed) return null;

    const event = safeJsonParse(parsed.data) as Record<string, unknown>;
    if (!event || typeof event !== 'object' || !event.type) return null;

    const type = event.type as string;

    switch (type) {
      case 'response.created':
        return this.onResponseCreated(event, ctx);
      case 'response.output_item.added':
        return this.onOutputItemAdded(event, ctx);
      case 'response.content_part.added':
        return this.onContentPartAdded(event, ctx);
      case 'response.text.delta':
        return this.onTextDelta(event, ctx);
      case 'response.output_text.delta':
        return this.onTextDelta(event, ctx);
      case 'response.function_call_arguments.delta':
        return this.onFunctionCallArgsDelta(event, ctx);
      case 'response.output_item.done':
        return this.onOutputItemDone(event, ctx);
      case 'response.completed':
        return this.onResponseCompleted(event, ctx);
      case 'error':
        return chunk; // forward errors
      default:
        return null;
    }
  }

  convertError(status: number, body: string): { status: number; body: string } {
    const parsed = safeJsonParse(body) as Record<string, unknown>;
    if (!parsed || !parsed.error) return { status, body };

    const error = parsed.error as Record<string, unknown>;
    const errorType = (error.type as string) || 'api_error';

    const typeMap: Record<string, string> = {
      invalid_request_error: 'invalid_request_error',
      authentication_error: 'authentication_error',
      permission_error: 'permission_error',
      not_found_error: 'not_found_error',
      rate_limit_error: 'rate_limit_error',
      api_error: 'api_error',
      server_error: 'api_error',
    };

    return {
      status: this.mapErrorStatus(status),
      body: JSON.stringify({
        type: 'error',
        error: {
          type: typeMap[errorType] || errorType,
          message: error.message || 'An error occurred',
        },
      }),
    };
  }

  // ── private helpers ──

  private convertInputItem(item: Record<string, unknown>): Record<string, unknown> {
    const role = item.role as string;
    const content = Array.isArray(item.content)
      ? (item.content as Array<Record<string, unknown>>).map((part) =>
          this.convertInputPart(part),
        )
      : [];

    return { role, content };
  }

  private convertInputPart(part: Record<string, unknown>): Record<string, unknown> {
    const partType = part.type as string;

    switch (partType) {
      case 'input_text':
        return { type: 'text', text: part.text || '' };
      case 'input_image': {
        const source = (part.source || {}) as Record<string, unknown>;
        return { type: 'image', source };
      }
      case 'function_call_output':
        return {
          type: 'tool_result',
          tool_use_id: part.call_id || '',
          content: part.output || '',
        };
      case 'output_text':
        return { type: 'text', text: part.text || '' };
      case 'function_call':
        return {
          type: 'tool_use',
          id: part.call_id || part.id || '',
          name: part.name || '',
          input: safeJsonParse((part.arguments as string) || '{}'),
        };
      case 'reasoning': {
        const summaryText = Array.isArray(part.summary)
          ? (part.summary as Array<{ type: string; text: string }>)
              .map((s) => s.text)
              .join('\n')
          : '';
        return { type: 'thinking', thinking: summaryText };
      }
      default:
        return part;
    }
  }

  private convertAnthropicBlock(block: Record<string, unknown>): ResponsesContentPart | null {
    const blockType = block.type as string;

    switch (blockType) {
      case 'text':
        return {
          type: 'output_text',
          text: (block.text as string) || '',
          annotations: [],
        };
      case 'tool_use':
        return {
          type: 'function_call',
          id: (block.id as string) || '',
          call_id: (block.id as string) || '',
          name: (block.name as string) || '',
          arguments: JSON.stringify(block.input || {}),
        };
      case 'thinking':
        return {
          type: 'reasoning',
          id: `rs_${Date.now()}`,
          summary: [{ type: 'summary_text', text: (block.thinking as string) || '' }],
        };
      default:
        return null;
    }
  }

  private convertReasoning(reasoning: unknown): Record<string, unknown> {
    const r = reasoning as Record<string, unknown>;
    const effort = (r.effort as string) || 'medium';

    const budgetMap: Record<string, number> = {
      low: 512,
      medium: 4096,
      high: 8192,
    };

    return {
      type: 'enabled',
      budget_tokens: budgetMap[effort] || 4096,
    };
  }

  private convertToolChoice(toolChoice: unknown): Record<string, unknown> | string {
    if (typeof toolChoice === 'string') {
      if (toolChoice === 'auto') return { type: 'auto' };
      if (toolChoice === 'required') return { type: 'any' };
      return { type: 'auto' };
    }

    const tc = toolChoice as Record<string, unknown>;
    const tcType = tc.type as string;

    if (tcType === 'function' && tc.name) {
      return { type: 'tool', name: tc.name };
    }

    return { type: 'auto' };
  }

  private mapErrorStatus(status: number): number {
    if (status === 429) return 429;
    if (status === 401 || status === 403) return status;
    if (status >= 500) return status;
    return status;
  }

  // ── stream event handlers ──

  private onResponseCreated(event: Record<string, unknown>, ctx: StreamContext): string {
    const resp = event.response as Record<string, unknown>;
    ctx.messageId = (resp.id as string) || `msg_${Date.now()}`;
    ctx.model = (resp.model as string) || '';

    const msgStart = {
      type: 'message_start',
      message: {
        id: ctx.messageId,
        type: 'message',
        role: 'assistant',
        content: [],
        model: ctx.model,
        stop_reason: null,
        stop_sequence: null,
        usage: resp.usage || { input_tokens: 0, output_tokens: 0 },
      },
    };

    return formatSSE('message_start', JSON.stringify(msgStart));
  }

  private onOutputItemAdded(event: Record<string, unknown>, ctx: StreamContext): string | null {
    const item = event.item as Record<string, unknown>;
    const itemType = item.type as string;
    const outputIdx = event.output_index as number;
    const itemId = (item.id as string) || '';

    if (itemType === 'message') {
      (ctx.roles as Map<number, string>).set(outputIdx, item.role as string);
      // Message output item doesn't directly map to a content_block_start;
      // content_part.added handles that.
      return null;
    }

    if (itemType === 'function_call') {
      (ctx.contentTypes as Map<string, string>).set(itemId, 'tool_use');
      const block = {
        type: 'content_block_start',
        index: outputIdx,
        content_block: {
          type: 'tool_use',
          id: item.call_id || item.id,
          name: item.name,
          input: {},
        },
      };
      return formatSSE('content_block_start', JSON.stringify(block));
    }

    if (itemType === 'reasoning') {
      (ctx.contentTypes as Map<string, string>).set(itemId, 'thinking');
      const block = {
        type: 'content_block_start',
        index: outputIdx,
        content_block: {
          type: 'thinking',
          thinking: '',
        },
      };
      return formatSSE('content_block_start', JSON.stringify(block));
    }

    return null;
  }

  private onContentPartAdded(event: Record<string, unknown>, _ctx: StreamContext): string | null {
    const part = event.part as Record<string, unknown>;
    const idx = event.content_index as number;

    if (part.type === 'output_text') {
      const block = {
        type: 'content_block_start',
        index: idx,
        content_block: {
          type: 'text',
          text: (part.text as string) || '',
        },
      };
      return formatSSE('content_block_start', JSON.stringify(block));
    }

    return null;
  }

  private onTextDelta(event: Record<string, unknown>, _ctx: StreamContext): string | null {
    const delta = (event.delta as string) || '';
    const idx = event.content_index as number;

    const anthropicDelta = {
      type: 'content_block_delta',
      index: idx,
      delta: {
        type: 'text_delta',
        text: delta,
      },
    };

    return formatSSE('content_block_delta', JSON.stringify(anthropicDelta));
  }

  private onFunctionCallArgsDelta(event: Record<string, unknown>, _ctx: StreamContext): string | null {
    const delta = (event.delta as string) || '';
    const outputIdx = event.output_index as number;

    const anthropicDelta = {
      type: 'content_block_delta',
      index: outputIdx,
      delta: {
        type: 'input_json_delta',
        partial_json: delta,
      },
    };

    return formatSSE('content_block_delta', JSON.stringify(anthropicDelta));
  }

  private onOutputItemDone(event: Record<string, unknown>, _ctx: StreamContext): string {
    const outputIdx = event.output_index as number;

    // Emit content_block_stop for this item
    const blockStop = {
      type: 'content_block_stop',
      index: outputIdx,
    };

    const msgDelta = {
      type: 'message_delta',
      delta: {
        stop_reason: 'end_turn',
        stop_sequence: null,
      },
      usage: { output_tokens: 0 },
    };

    return (
      formatSSE('content_block_stop', JSON.stringify(blockStop)) +
      formatSSE('message_delta', JSON.stringify(msgDelta))
    );
  }

  private onResponseCompleted(event: Record<string, unknown>, _ctx: StreamContext): string {
    const resp = event.response as Record<string, unknown>;
    const usage = resp.usage || {};

    const msgDelta = {
      type: 'message_delta',
      delta: {
        stop_reason: 'end_turn',
        stop_sequence: null,
      },
      usage,
    };

    return (
      formatSSE('message_delta', JSON.stringify(msgDelta)) +
      formatSSE('message_stop', JSON.stringify({ type: 'message_stop' }))
    );
  }
}

// ──────────────────────────────────────
// Exports
// ──────────────────────────────────────

export { AnthropicToResponsesConverter, ResponsesToAnthropicConverter };
