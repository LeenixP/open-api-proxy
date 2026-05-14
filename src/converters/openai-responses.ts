import { parseSSELine, formatSSE, isDoneChunk, safeJsonParse } from './helpers.js';
import type { Converter } from '../types.js';

let idCounter = 0;
function genId(prefix: string): string {
  return `${prefix}_${Date.now()}_${++idCounter}_${Math.random().toString(36).slice(2, 6)}`;
}

// ============================================================================
// OpenAI Chat → OpenAI Responses
// ============================================================================

export class OpenAIChatToResponsesConverter implements Converter {
  readonly fromProtocol = 'openai';
  readonly toProtocol = 'openai-responses';

  private sentCreated = false;
  private outputIdx = 0;
  private curTextItemId = '';
  private fnCallIds: string[] = [];
  private responseId = '';

  private resetStream(): void {
    this.sentCreated = false;
    this.outputIdx = 0;
    this.curTextItemId = '';
    this.fnCallIds = [];
    this.responseId = genId('resp');
  }

  convertRequest(body: Record<string, unknown>, _targetModel: string): Record<string, unknown> {
    this.resetStream();

    const messages = (body.messages as Array<Record<string, unknown>>) || [];
    const result: Record<string, unknown> = {};

    // Copy model if present
    if (body.model !== undefined) result.model = body.model;

    // Extract system message → instructions
    const sysMsg = messages.find((m) => m.role === 'system');
    if (sysMsg) {
      if (typeof sysMsg.content === 'string') {
        result.instructions = sysMsg.content;
      } else if (Array.isArray(sysMsg.content)) {
        result.instructions = (sysMsg.content as Array<Record<string, unknown>>)
          .filter((p) => p.type === 'text')
          .map((p) => p.text as string)
          .join('');
      }
    }

    // Convert messages → input
    const input: Array<Record<string, unknown>> = [];
    for (const msg of messages) {
      if (msg.role === 'system') continue;

      if (msg.role === 'user') {
        if (typeof msg.content === 'string') {
          input.push({
            role: 'user',
            content: [{ type: 'input_text', text: msg.content }],
          });
        } else if (Array.isArray(msg.content)) {
          const parts = (msg.content as Array<Record<string, unknown>>).map((part) => {
            if (part.type === 'text') {
              return { type: 'input_text', text: part.text };
            }
            if (part.type === 'image_url') {
              return { type: 'input_image', image_url: part.image_url };
            }
            return part;
          });
          input.push({ role: 'user', content: parts });
        }
      } else if (msg.role === 'assistant') {
        const contentParts: Array<Record<string, unknown>> = [];
        const funcCalls: Array<Record<string, unknown>> = [];

        if (msg.content) {
          contentParts.push({
            type: 'output_text',
            text: msg.content,
            annotations: [],
          });
        }

        if (msg.tool_calls) {
          for (const tc of msg.tool_calls as Array<Record<string, unknown>>) {
            const fn = tc.function as Record<string, unknown>;
            funcCalls.push({
              type: 'function_call',
              call_id: tc.id,
              name: fn.name,
              arguments: fn.arguments,
            });
          }
        }

        if (contentParts.length > 0) {
          input.push({ role: 'assistant', content: contentParts });
        }
        for (const fc of funcCalls) {
          input.push(fc);
        }
      } else if (msg.role === 'tool') {
        input.push({
          type: 'function_call_output',
          call_id: msg.tool_call_id,
          output: msg.content,
        });
      }
    }

    result.input = input;

    // Convert tools
    if (body.tools) {
      result.tools = (body.tools as Array<Record<string, unknown>>).map((tool) => {
        const fn = (tool as Record<string, unknown>).function as Record<string, unknown>;
        return {
          type: 'function',
          name: fn.name,
          description: fn.description,
          parameters: fn.parameters,
        };
      });
    }

    // Map max tokens
    if (body.max_completion_tokens !== undefined) {
      result.max_output_tokens = body.max_completion_tokens;
    } else if (body.max_tokens !== undefined) {
      result.max_output_tokens = body.max_tokens;
    }

    // Pass through
    if (body.temperature !== undefined) result.temperature = body.temperature;
    if (body.top_p !== undefined) result.top_p = body.top_p;
    if (body.stop !== undefined) result.stop = body.stop;
    if (body.stream !== undefined) result.stream = body.stream;

    // Convert reasoning_effort → reasoning
    if (body.reasoning_effort !== undefined) {
      result.reasoning = { effort: body.reasoning_effort, summary: 'auto' };
    }

    return result;
  }

  convertResponse(body: Record<string, unknown>): Record<string, unknown> {
    // Responses output[] → Chat completion choices[]
    const output = (body.output as Array<Record<string, unknown>>) || [];
    const toolCalls: Array<Record<string, unknown>> = [];
    let contentText = '';

    for (const item of output) {
      if (item.type === 'message') {
        const contentArr = (item.content as Array<Record<string, unknown>>) || [];
        for (const c of contentArr) {
          if (c.type === 'output_text') {
            contentText += String(c.text || '');
          }
        }
      } else if (item.type === 'function_call') {
        toolCalls.push({
          id: item.call_id,
          type: 'function',
          function: {
            name: item.name,
            arguments: item.arguments,
          },
        });
      }
    }

    const message: Record<string, unknown> = { role: 'assistant' };
    message.content = contentText || null;
    if (toolCalls.length > 0) {
      message.tool_calls = toolCalls;
    }

    const choices = [
      {
        index: 0,
        message,
        finish_reason: body.status === 'completed' ? 'stop' : 'length',
      },
    ];

    const result: Record<string, unknown> = {
      id: (body.id as string) || genId('chatcmpl'),
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: body.model,
      choices,
    };

    // Map usage tokens
    if (body.usage) {
      const u = body.usage as Record<string, unknown>;
      result.usage = {
        prompt_tokens: u.input_tokens || 0,
        completion_tokens: u.output_tokens || 0,
        total_tokens: u.total_tokens || 0,
      };
    }

    return result;
  }

  convertStreamChunk(chunk: string): string | null {
    if (isDoneChunk(chunk)) {
      this.resetStream();
      return null;
    }

    const parsed = parseSSELine(chunk);
    if (!parsed) return null;

    const data = safeJsonParse(parsed.data) as Record<string, unknown>;
    if (!data.choices) return null;

    const choices = data.choices as Array<Record<string, unknown>>;
    if (!choices || choices.length === 0) return null;

    const delta = choices[0].delta as Record<string, unknown> | undefined;
    const finishReason = choices[0].finish_reason as string | undefined | null;
    const parts: string[] = [];

    // Emit response.created on first chunk with role or content
    if (!this.sentCreated && (delta?.role === 'assistant' || delta?.content)) {
      this.sentCreated = true;
      parts.push(
        formatSSE(
          'response.created',
          JSON.stringify({
            type: 'response.created',
            response: {
              id: this.responseId,
              object: 'response',
              status: 'in_progress',
              output: [],
            },
          }),
        ),
      );
    }

    // Handle text content delta
    if (delta?.content && typeof delta.content === 'string' && delta.content.length > 0) {
      if (!this.curTextItemId) {
        this.curTextItemId = genId('item');
        parts.push(
          formatSSE(
            'response.output_item.added',
            JSON.stringify({
              type: 'response.output_item.added',
              output_index: this.outputIdx,
              item: {
                id: this.curTextItemId,
                type: 'message',
                role: 'assistant',
                content: [],
                status: 'in_progress',
              },
            }),
          ),
        );
      }
      parts.push(
        formatSSE(
          'response.text.delta',
          JSON.stringify({
            type: 'response.text.delta',
            item_id: this.curTextItemId,
            output_index: this.outputIdx,
            content_index: 0,
            delta: delta.content,
          }),
        ),
      );
    }

    // Handle tool_calls delta
    if (delta?.tool_calls) {
      const toolCalls = delta.tool_calls as Array<Record<string, unknown>>;
      for (let i = 0; i < toolCalls.length; i++) {
        const tc = toolCalls[i];
        const tcIdx = tc.index !== undefined ? Number(tc.index) : i;
        const fn = tc.function as Record<string, unknown> | undefined;

        // First appearance with name → output_item.added
        if (fn?.name && !this.fnCallIds[tcIdx]) {
          const itemId = genId('item');
          this.fnCallIds[tcIdx] = itemId;
          const outIdx = this.outputIdx + (this.curTextItemId ? 1 : 0) + tcIdx;
          parts.push(
            formatSSE(
              'response.output_item.added',
              JSON.stringify({
                type: 'response.output_item.added',
                output_index: outIdx,
                item: {
                  id: itemId,
                  type: 'function_call',
                  name: fn.name,
                  arguments: '',
                  status: 'in_progress',
                },
              }),
            ),
          );
        }

        // Arguments delta
        if (fn?.arguments && typeof fn.arguments === 'string') {
          const itemId = this.fnCallIds[tcIdx];
          const outIdx = this.outputIdx + (this.curTextItemId ? 1 : 0) + tcIdx;
          parts.push(
            formatSSE(
              'response.function_call_arguments.delta',
              JSON.stringify({
                type: 'response.function_call_arguments.delta',
                item_id: itemId,
                output_index: outIdx,
                delta: fn.arguments,
              }),
            ),
          );
        }
      }
    }

    // Handle finish_reason → response.completed
    if (finishReason && finishReason !== '') {
      const usageOut =
        data.usage
          ? {
              input_tokens: (data.usage as Record<string, unknown>).prompt_tokens || 0,
              output_tokens: (data.usage as Record<string, unknown>).completion_tokens || 0,
              total_tokens: (data.usage as Record<string, unknown>).total_tokens || 0,
            }
          : undefined;

      parts.push(
        formatSSE(
          'response.completed',
          JSON.stringify({
            type: 'response.completed',
            response: {
              id: this.responseId,
              object: 'response',
              status: 'completed',
              model: data.model,
              output: [],
              ...(usageOut ? { usage: usageOut } : {}),
            },
          }),
        ),
      );
      this.resetStream();
    }

    return parts.length > 0 ? parts.join('') : null;
  }

  convertError(status: number, body: string): { status: number; body: string } {
    return { status, body };
  }
}

// ============================================================================
// OpenAI Responses → OpenAI Chat
// ============================================================================

export class ResponsesToOpenAIChatConverter implements Converter {
  readonly fromProtocol = 'openai-responses';
  readonly toProtocol = 'openai';

  private sentCreated = false;
  private curToolIdx = 0;
  private fnCallId = '';
  private fnCallName = '';
  private streamId = '';

  private resetStream(): void {
    this.sentCreated = false;
    this.curToolIdx = 0;
    this.fnCallId = '';
    this.fnCallName = '';
    this.streamId = genId('chatcmpl');
  }

  convertRequest(body: Record<string, unknown>, _targetModel: string): Record<string, unknown> {
    this.resetStream();

    const result: Record<string, unknown> = {};
    if (body.model !== undefined) result.model = body.model;

    const messages: Array<Record<string, unknown>> = [];

    // instructions → system message
    if (body.instructions && typeof body.instructions === 'string') {
      messages.push({ role: 'system', content: body.instructions });
    }

    // input[] → messages
    const input = (body.input as Array<Record<string, unknown>>) || [];
    for (const item of input) {
      if (item.role === 'user') {
        if (typeof item.content === 'string') {
          messages.push({ role: 'user', content: item.content });
        } else if (Array.isArray(item.content)) {
          const parts = (item.content as Array<Record<string, unknown>>).map((part) => {
            if (part.type === 'input_text') {
              return { type: 'text', text: part.text };
            }
            if (part.type === 'input_image') {
              return { type: 'image_url', image_url: part.image_url };
            }
            return part;
          });
          messages.push({ role: 'user', content: parts });
        }
      } else if (item.role === 'assistant') {
        const contentArr = (item.content as Array<Record<string, unknown>>) || [];
        const textParts = contentArr.filter((c) => c.type === 'output_text');
        const content = textParts.map((t) => (t.text as string) || '').join('') || null;
        messages.push({ role: 'assistant', content });
      } else if (item.type === 'function_call') {
        const toolCall = {
          id: item.call_id || genId('call'),
          type: 'function',
          function: {
            name: item.name,
            arguments: item.arguments,
          },
        };
        // Merge into previous assistant message or create a new one
        const lastMsg = messages.length > 0 ? messages[messages.length - 1] : null;
        if (lastMsg && lastMsg.role === 'assistant') {
          const existing = (lastMsg.tool_calls as Array<Record<string, unknown>>) || [];
          existing.push(toolCall);
          lastMsg.tool_calls = existing;
        } else {
          messages.push({
            role: 'assistant',
            content: null,
            tool_calls: [toolCall],
          });
        }
      } else if (item.type === 'function_call_output') {
        messages.push({
          role: 'tool',
          tool_call_id: item.call_id,
          content: item.output,
        });
      }
    }

    result.messages = messages;

    // Convert tools back
    if (body.tools) {
      result.tools = (body.tools as Array<Record<string, unknown>>).map((tool) => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        },
      }));
    }

    // max_output_tokens → max_completion_tokens
    if (body.max_output_tokens !== undefined) {
      result.max_completion_tokens = body.max_output_tokens;
    }

    // Pass through
    if (body.temperature !== undefined) result.temperature = body.temperature;
    if (body.top_p !== undefined) result.top_p = body.top_p;
    if (body.stop !== undefined) result.stop = body.stop;
    if (body.stream !== undefined) result.stream = body.stream;

    // reasoning → reasoning_effort
    if (body.reasoning) {
      const r = body.reasoning as Record<string, unknown>;
      if (r.effort) result.reasoning_effort = r.effort;
    }

    return result;
  }

  convertResponse(body: Record<string, unknown>): Record<string, unknown> {
    // Chat completion → Responses output
    const choices = (body.choices as Array<Record<string, unknown>>) || [];
    const output: Array<Record<string, unknown>> = [];

    if (choices.length > 0) {
      const message = choices[0].message as Record<string, unknown>;
      const contentParts: Array<Record<string, unknown>> = [];

      if (message.content && typeof message.content === 'string') {
        contentParts.push({
          type: 'output_text',
          text: message.content,
          annotations: [],
        });
      }

      if (contentParts.length > 0) {
        output.push({
          id: genId('msg'),
          type: 'message',
          role: 'assistant',
          content: contentParts,
        });
      }

      if (message.tool_calls) {
        for (const tc of message.tool_calls as Array<Record<string, unknown>>) {
          const fn = tc.function as Record<string, unknown>;
          output.push({
            id: genId('fc'),
            type: 'function_call',
            call_id: tc.id,
            name: fn.name,
            arguments: fn.arguments,
          });
        }
      }
    }

    const result: Record<string, unknown> = {
      id: body.id || genId('resp'),
      object: 'response',
      output,
      status: choices.length > 0 && choices[0].finish_reason === 'stop' ? 'completed' : 'incomplete',
      model: body.model,
    };

    // Map usage tokens
    if (body.usage) {
      const u = body.usage as Record<string, unknown>;
      result.usage = {
        input_tokens: u.prompt_tokens || 0,
        output_tokens: u.completion_tokens || 0,
        total_tokens: u.total_tokens || 0,
      };
    }

    return result;
  }

  convertStreamChunk(chunk: string): string | null {
    if (isDoneChunk(chunk)) {
      this.resetStream();
      return null;
    }

    const parsed = parseSSELine(chunk);
    if (!parsed) return null;

    const data = safeJsonParse(parsed.data) as Record<string, unknown>;
    if (!data || Object.keys(data).length === 0) return null;

    const eventType = data.type as string;
    if (!eventType) return null;

    let result = '';

    if (eventType === 'response.created') {
      this.sentCreated = true;
      const response = (data.response as Record<string, unknown>) || {};
      result = formatSSE(
        '',
        JSON.stringify({
          id: this.streamId,
          object: 'chat.completion.chunk',
          created: Math.floor(Date.now() / 1000),
          model: response.model || '',
          choices: [{ index: 0, delta: { role: 'assistant' }, finish_reason: null }],
        }),
      );
    } else if (eventType === 'response.text.delta' || eventType === 'response.output_text.delta') {
      result = formatSSE(
        '',
        JSON.stringify({
          id: this.streamId,
          object: 'chat.completion.chunk',
          created: Math.floor(Date.now() / 1000),
          model: '',
          choices: [{ index: 0, delta: { content: data.delta }, finish_reason: null }],
        }),
      );
    } else if (eventType === 'response.output_item.added') {
      const item = (data.item as Record<string, unknown>) || {};
      if (item.type === 'function_call') {
        this.fnCallId = (item.id as string) || genId('call');
        this.fnCallName = (item.name as string) || '';
        result = formatSSE(
          '',
          JSON.stringify({
            id: this.streamId,
            object: 'chat.completion.chunk',
            created: Math.floor(Date.now() / 1000),
            model: '',
            choices: [
              {
                index: 0,
                delta: {
                  tool_calls: [
                    {
                      index: this.curToolIdx,
                      id: this.fnCallId,
                      type: 'function',
                      function: { name: this.fnCallName, arguments: '' },
                    },
                  ],
                },
                finish_reason: null,
              },
            ],
          }),
        );
      }
    } else if (eventType === 'response.function_call_arguments.delta') {
      result = formatSSE(
        '',
        JSON.stringify({
          id: this.streamId,
          object: 'chat.completion.chunk',
          created: Math.floor(Date.now() / 1000),
          model: '',
          choices: [
            {
              index: 0,
              delta: {
                tool_calls: [
                  { index: this.curToolIdx, function: { arguments: data.delta } },
                ],
              },
              finish_reason: null,
            },
          ],
        }),
      );
    } else if (eventType === 'response.completed') {
      const response = (data.response as Record<string, unknown>) || {};
      const usage = response.usage as Record<string, unknown> | undefined;
      const usageOut = usage
        ? {
            prompt_tokens: usage.input_tokens || 0,
            completion_tokens: usage.output_tokens || 0,
            total_tokens: usage.total_tokens || 0,
          }
        : undefined;

      result = formatSSE(
        '',
        JSON.stringify({
          id: this.streamId,
          object: 'chat.completion.chunk',
          created: Math.floor(Date.now() / 1000),
          model: response.model || '',
          choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
          ...(usageOut ? { usage: usageOut } : {}),
        }),
      );
      this.resetStream();
    } else {
      return null;
    }

    return result || null;
  }

  convertError(status: number, body: string): { status: number; body: string } {
    return { status, body };
  }
}
