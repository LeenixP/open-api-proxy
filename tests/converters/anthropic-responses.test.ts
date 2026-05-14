import { describe, it, expect } from 'vitest';
import { AnthropicToResponsesConverter, ResponsesToAnthropicConverter } from '../../src/converters/anthropic-responses.js';
import type { StreamContext } from '../../src/types.js';

// ──────────────────────────────────────────────
// Anthropic → OpenAI Responses
// ──────────────────────────────────────────────

describe('AnthropicToResponsesConverter', () => {
  let anthropicToResponses: AnthropicToResponsesConverter;

  beforeEach(() => {
    anthropicToResponses = new AnthropicToResponsesConverter();
  });

  describe('convertRequest', () => {
    it('should convert basic text messages', () => {
      const result = anthropicToResponses.convertRequest(
        {
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1024,
          messages: [
            {
              role: 'user',
              content: [{ type: 'text', text: 'Hello, how are you?' }],
            },
          ],
        },
        'gpt-5',
      );

      expect(result.model).toBe('gpt-5');
      expect(result.max_output_tokens).toBe(1024);
      expect(result.input).toEqual([
        {
          role: 'user',
          content: [{ type: 'input_text', text: 'Hello, how are you?' }],
        },
      ]);
    });

    it('should convert system to instructions (string)', () => {
      const result = anthropicToResponses.convertRequest(
        {
          model: 'claude-sonnet-4-20250514',
          max_tokens: 100,
          system: 'You are a helpful assistant.',
          messages: [{ role: 'user', content: [{ type: 'text', text: 'Hi' }] }],
        },
        'gpt-5',
      );

      expect(result.instructions).toBe('You are a helpful assistant.');
    });

    it('should convert system array to instructions string', () => {
      const result = anthropicToResponses.convertRequest(
        {
          model: 'claude-sonnet-4-20250514',
          max_tokens: 100,
          system: [
            { type: 'text', text: 'First instruction.' },
            { type: 'text', text: 'Second instruction.' },
          ],
          messages: [{ role: 'user', content: [{ type: 'text', text: 'Hi' }] }],
        },
        'gpt-5',
      );

      expect(result.instructions).toBe('First instruction.\nSecond instruction.');
    });

    it('should convert tools to function format', () => {
      const result = anthropicToResponses.convertRequest(
        {
          model: 'claude-sonnet-4-20250514',
          max_tokens: 100,
          messages: [{ role: 'user', content: [{ type: 'text', text: 'What is the weather?' }] }],
          tools: [
            {
              name: 'get_weather',
              description: 'Get current weather for a location',
              input_schema: {
                type: 'object',
                properties: {
                  location: { type: 'string', description: 'City name' },
                },
                required: ['location'],
              },
            },
          ],
        },
        'gpt-5',
      );

      expect(result.tools).toEqual([
        {
          type: 'function',
          name: 'get_weather',
          description: 'Get current weather for a location',
          parameters: {
            type: 'object',
            properties: {
              location: { type: 'string', description: 'City name' },
            },
            required: ['location'],
          },
        },
      ]);
    });

    it('should convert thinking budget to reasoning', () => {
      const result = anthropicToResponses.convertRequest(
        {
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4096,
          messages: [{ role: 'user', content: [{ type: 'text', text: 'Solve this problem.' }] }],
          thinking: { type: 'enabled', budget_tokens: 8192 },
        },
        'gpt-5',
      );

      expect(result.reasoning).toEqual({ effort: 'high', summary: 'auto' });
    });

    it('should convert thinking with medium effort', () => {
      const result = anthropicToResponses.convertRequest(
        {
          model: 'claude-sonnet-4-20250514',
          max_tokens: 100,
          messages: [{ role: 'user', content: [{ type: 'text', text: 'Hi' }] }],
          thinking: { type: 'enabled', budget_tokens: 2000 },
        },
        'gpt-5',
      );

      expect(result.reasoning).toEqual({ effort: 'medium', summary: 'auto' });
    });

    it('should convert tool_choice auto', () => {
      const result = anthropicToResponses.convertRequest(
        {
          model: 'claude-sonnet-4-20250514',
          max_tokens: 100,
          messages: [{ role: 'user', content: [{ type: 'text', text: 'Hi' }] }],
          tool_choice: { type: 'auto' },
        },
        'gpt-5',
      );

      expect(result.tool_choice).toBe('auto');
    });

    it('should convert tool_choice any to required', () => {
      const result = anthropicToResponses.convertRequest(
        {
          model: 'claude-sonnet-4-20250514',
          max_tokens: 100,
          messages: [{ role: 'user', content: [{ type: 'text', text: 'Hi' }] }],
          tool_choice: { type: 'any' },
        },
        'gpt-5',
      );

      expect(result.tool_choice).toBe('required');
    });

    it('should convert tool_use and tool_result messages', () => {
      const result = anthropicToResponses.convertRequest(
        {
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1024,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: 'Check the weather in NYC.' },
                {
                  type: 'tool_result',
                  tool_use_id: 'toolu_001',
                  content: 'The weather in NYC is sunny, 72°F.',
                },
              ],
            },
            {
              role: 'assistant',
              content: [
                {
                  type: 'tool_use',
                  id: 'toolu_001',
                  name: 'get_weather',
                  input: { location: 'NYC' },
                },
              ],
            },
          ],
        },
        'gpt-5',
      );

      expect(result.input).toHaveLength(2);

      const userInput = result.input as Array<Record<string, unknown>>;
      const userContent = userInput[0].content as Array<Record<string, unknown>>;
      expect(userContent[0]).toEqual({ type: 'input_text', text: 'Check the weather in NYC.' });
      expect(userContent[1]).toEqual({
        type: 'function_call_output',
        call_id: 'toolu_001',
        output: 'The weather in NYC is sunny, 72°F.',
      });

      const asstContent = userInput[1].content as Array<Record<string, unknown>>;
      expect(asstContent[0]).toMatchObject({
        type: 'function_call',
        call_id: 'toolu_001',
        name: 'get_weather',
      });
      expect(asstContent[0].arguments).toBe('{"location":"NYC"}');
    });

    it('should convert assistant text to output_text with annotations', () => {
      const result = anthropicToResponses.convertRequest(
        {
          model: 'claude-sonnet-4-20250514',
          max_tokens: 100,
          messages: [
            { role: 'user', content: [{ type: 'text', text: 'Hello' }] },
            {
              role: 'assistant',
              content: [{ type: 'text', text: 'Hi! How can I help?' }],
            },
          ],
        },
        'gpt-5',
      );

      const input = result.input as Array<Record<string, unknown>>;
      const asstContent = input[1].content as Array<Record<string, unknown>>;
      expect(asstContent[0]).toEqual({
        type: 'output_text',
        text: 'Hi! How can I help?',
        annotations: [],
      });
    });

    it('should pass through temperature, top_p, and stream', () => {
      const result = anthropicToResponses.convertRequest(
        {
          model: 'claude-sonnet-4-20250514',
          max_tokens: 100,
          messages: [{ role: 'user', content: [{ type: 'text', text: 'Hi' }] }],
          temperature: 0.7,
          top_p: 0.9,
          stream: true,
        },
        'gpt-5',
      );

      expect(result.temperature).toBe(0.7);
      expect(result.top_p).toBe(0.9);
      expect(result.stream).toBe(true);
    });

    it('should convert image block in user message', () => {
      const result = anthropicToResponses.convertRequest(
        {
          model: 'claude-sonnet-4-20250514',
          max_tokens: 100,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: 'Describe this image:' },
                {
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: 'image/png',
                    data: 'iVBORw0KGgo...',
                  },
                },
              ],
            },
          ],
        },
        'gpt-5',
      );

      const input = result.input as Array<Record<string, unknown>>;
      const userContent = input[0].content as Array<Record<string, unknown>>;
      expect(userContent[1]).toEqual({
        type: 'input_image',
        source: { type: 'base64', media_type: 'image/png', data: 'iVBORw0KGgo...' },
      });
    });
  });

  describe('convertResponse', () => {
    it('should convert Responses output to Anthropic message format', () => {
      const result = anthropicToResponses.convertResponse({
        id: 'resp_abc123',
        object: 'response',
        model: 'gpt-5',
        status: 'completed',
        output: [
          {
            type: 'message',
            id: 'msg_abc123',
            role: 'assistant',
            status: 'completed',
            content: [
              { type: 'output_text', text: 'Hello! How can I assist you today?', annotations: [] },
            ],
          },
        ],
        usage: { input_tokens: 15, output_tokens: 8 },
      });

      expect(result.id).toBe('resp_abc123');
      expect(result.role).toBe('assistant');
      expect(result.stop_reason).toBe('end_turn');
      expect(result.model).toBe('gpt-5');
      expect(result.content).toEqual([
        { type: 'text', text: 'Hello! How can I assist you today?' },
      ]);
      expect(result.usage).toEqual({ input_tokens: 15, output_tokens: 8 });
    });

    it('should handle function_call in output', () => {
      const result = anthropicToResponses.convertResponse({
        id: 'resp_abc123',
        object: 'response',
        model: 'gpt-5',
        status: 'completed',
        output: [
          {
            type: 'function_call',
            id: 'fc_001',
            call_id: 'call_abc123',
            name: 'get_weather',
            arguments: '{"location":"New York"}',
            status: 'completed',
          },
        ],
        usage: { input_tokens: 20, output_tokens: 15 },
      });

      expect(result.content).toEqual([
        {
          type: 'tool_use',
          id: 'call_abc123',
          name: 'get_weather',
          input: { location: 'New York' },
        },
      ]);
    });

    it('should handle error/failed status', () => {
      const result = anthropicToResponses.convertResponse({
        id: 'resp_err',
        object: 'response',
        model: 'gpt-5',
        status: 'failed',
        error: { type: 'server_error', message: 'Internal error' },
        output: [],
      });

      expect(result.stop_reason).toBe('error');
      expect(result.content).toEqual([]);
    });

    it('should convert mixed output with reasoning', () => {
      const result = anthropicToResponses.convertResponse({
        id: 'resp_mixed',
        object: 'response',
        model: 'gpt-5',
        status: 'completed',
        output: [
          {
            type: 'reasoning',
            id: 'rs_001',
            summary: [{ type: 'summary_text', text: 'I need to think about this carefully.' }],
          },
          {
            type: 'message',
            id: 'msg_001',
            role: 'assistant',
            status: 'completed',
            content: [
              { type: 'output_text', text: 'The answer is 42.', annotations: [] },
            ],
          },
        ],
        usage: { input_tokens: 30, output_tokens: 50 },
      });

      expect(result.content).toEqual([
        { type: 'thinking', thinking: 'I need to think about this carefully.' },
        { type: 'text', text: 'The answer is 42.' },
      ]);
    });
  });

  describe('convertStreamChunk', () => {
    let ctx: StreamContext;

    beforeEach(() => {
      ctx = anthropicToResponses.createStreamContext();
    });

    it('should convert message_start to response.created and response.output_item.added', () => {
      const chunk = 'event: message_start\ndata: {"type":"message_start","message":{"id":"msg_001","type":"message","role":"assistant","model":"claude-sonnet-4-20250514","content":[],"stop_reason":null,"stop_sequence":null,"usage":{"input_tokens":10,"output_tokens":1}}}\n\n';

      const result = anthropicToResponses.convertStreamChunk(chunk, ctx);

      expect(result).toContain('event: response.created');
      expect(result).toContain('"type":"response.created"');
      expect(result).toContain('event: response.output_item.added');
      expect(result).toContain('"type":"response.output_item.added"');
      expect(result).toContain('"output_index":0');
    });

    it('should convert text content_block_start to response.content_part.added', () => {
      const chunk = 'event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}\n\n';

      const result = anthropicToResponses.convertStreamChunk(chunk, ctx);

      expect(result).toContain('event: response.content_part.added');
      expect(result).toContain('"type":"response.content_part.added"');
      expect(result).toContain('"type":"output_text"');
      expect(result).toContain('"content_index":0');
    });

    it('should convert text_delta to response.text.delta', () => {
      // First set up state with message_start
      anthropicToResponses.convertStreamChunk(
        'event: message_start\ndata: {"type":"message_start","message":{"id":"msg_001","type":"message","role":"assistant","model":"claude-sonnet-4-20250514","content":[],"stop_reason":null,"stop_sequence":null,"usage":{"input_tokens":10,"output_tokens":1}}}\n\n', ctx,
      );
      // Then content_block_start
      anthropicToResponses.convertStreamChunk(
        'event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}\n\n', ctx,
      );

      const chunk = 'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello, world!"}}\n\n';
      const result = anthropicToResponses.convertStreamChunk(chunk, ctx);

      expect(result).toContain('event: response.text.delta');
      expect(result).toContain('"type":"response.text.delta"');
      expect(result).toContain('"delta":"Hello, world!"');
    });

    it('should convert input_json_delta to function_call_arguments.delta', () => {
      // Set up state
      anthropicToResponses.convertStreamChunk(
        'event: message_start\ndata: {"type":"message_start","message":{"id":"msg_001","type":"message","role":"assistant","model":"claude-sonnet-4-20250514","content":[],"stop_reason":null,"stop_sequence":null,"usage":{"input_tokens":10,"output_tokens":1}}}\n\n', ctx,
      );
      anthropicToResponses.convertStreamChunk(
        'event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"tool_use","id":"toolu_001","name":"get_weather","input":{}}}\n\n', ctx,
      );

      const chunk = 'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":"{\\"location\\":\\""}}\n\n';
      const result = anthropicToResponses.convertStreamChunk(chunk, ctx);

      expect(result).toContain('event: response.function_call_arguments.delta');
      expect(result).toContain('"type":"response.function_call_arguments.delta"');
    });

    it('should convert tool_use start to response.output_item.added', () => {
      // Set up state
      anthropicToResponses.convertStreamChunk(
        'event: message_start\ndata: {"type":"message_start","message":{"id":"msg_001","type":"message","role":"assistant","model":"claude-sonnet-4-20250514","content":[],"stop_reason":null,"stop_sequence":null,"usage":{"input_tokens":10,"output_tokens":1}}}\n\n', ctx,
      );

      const chunk = 'event: content_block_start\ndata: {"type":"content_block_start","index":1,"content_block":{"type":"tool_use","id":"toolu_001","name":"get_weather","input":{}}}\n\n';
      const result = anthropicToResponses.convertStreamChunk(chunk, ctx);

      expect(result).toContain('event: response.output_item.added');
      expect(result).toContain('"type":"function_call"');
      expect(result).toContain('"name":"get_weather"');
      expect(result).toContain('"output_index":1');
    });

    it('should forward content_block_stop as-is', () => {
      const chunk = 'event: content_block_stop\ndata: {"type":"content_block_stop","index":0}\n\n';
      const result = anthropicToResponses.convertStreamChunk(chunk, ctx);

      expect(result).toBe(chunk);
    });

    it('should convert message_delta to response.output_item.done and response.completed', () => {
      // Set up state
      anthropicToResponses.convertStreamChunk(
        'event: message_start\ndata: {"type":"message_start","message":{"id":"msg_001","type":"message","role":"assistant","model":"claude-sonnet-4-20250514","content":[],"stop_reason":null,"stop_sequence":null,"usage":{"input_tokens":10,"output_tokens":1}}}\n\n', ctx,
      );

      const chunk = 'event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn","stop_sequence":null},"usage":{"output_tokens":25}}\n\n';
      const result = anthropicToResponses.convertStreamChunk(chunk, ctx);

      expect(result).toContain('event: response.output_item.done');
      expect(result).toContain('"type":"response.output_item.done"');
      expect(result).toContain('event: response.completed');
      expect(result).toContain('"type":"response.completed"');
    });

    it('should convert message_stop to [DONE]', () => {
      const chunk = 'event: message_stop\ndata: {"type":"message_stop"}\n\n';
      const result = anthropicToResponses.convertStreamChunk(chunk, ctx);

      expect(result).toBe('data: [DONE]\n\n');
    });

    it('should forward error stream events', () => {
      const chunk = 'event: error\ndata: {"type":"error","error":{"type":"overloaded_error","message":"Server is busy"}}\n\n';
      const result = anthropicToResponses.convertStreamChunk(chunk, ctx);

      expect(result).toBe(chunk);
    });
  });

  describe('convertError', () => {
    it('should map Anthropic error to Responses error format', () => {
      const result = anthropicToResponses.convertError(
        400,
        JSON.stringify({
          type: 'error',
          error: { type: 'invalid_request_error', message: 'max_tokens is required' },
        }),
      );

      expect(result.status).toBe(400);
      const parsed = JSON.parse(result.body);
      expect(parsed.type).toBe('error');
      expect(parsed.error.type).toBe('invalid_request_error');
      expect(parsed.error.message).toBe('max_tokens is required');
    });

    it('should map overloaded_error to server_error', () => {
      const result = anthropicToResponses.convertError(
        529,
        JSON.stringify({
          type: 'error',
          error: { type: 'overloaded_error', message: 'Overloaded' },
        }),
      );

      const parsed = JSON.parse(result.body);
      expect(parsed.error.type).toBe('server_error');
    });
  });
});

// ──────────────────────────────────────────────
// OpenAI Responses → Anthropic
// ──────────────────────────────────────────────

describe('ResponsesToAnthropicConverter', () => {
  let responsesToAnthropic: ResponsesToAnthropicConverter;

  beforeEach(() => {
    responsesToAnthropic = new ResponsesToAnthropicConverter();
  });

  describe('convertRequest', () => {
    it('should convert input_text to Anthropic message', () => {
      const result = responsesToAnthropic.convertRequest(
        {
          model: 'gpt-5',
          max_output_tokens: 1024,
          input: [
            {
              role: 'user',
              content: [{ type: 'input_text', text: 'Hello, Claude!' }],
            },
          ],
        },
        'claude-sonnet-4-20250514',
      );

      expect(result.model).toBe('claude-sonnet-4-20250514');
      expect(result.max_tokens).toBe(1024);
      expect(result.messages).toEqual([
        {
          role: 'user',
          content: [{ type: 'text', text: 'Hello, Claude!' }],
        },
      ]);
    });

    it('should convert instructions to system array', () => {
      const result = responsesToAnthropic.convertRequest(
        {
          model: 'gpt-5',
          max_output_tokens: 100,
          instructions: 'You are a helpful coding assistant.',
          input: [
            { role: 'user', content: [{ type: 'input_text', text: 'Write a function.' }] },
          ],
        },
        'claude-sonnet-4-20250514',
      );

      expect(result.system).toEqual([
        { type: 'text', text: 'You are a helpful coding assistant.', cache_control: null },
      ]);
    });

    it('should convert reasoning to thinking', () => {
      const result = responsesToAnthropic.convertRequest(
        {
          model: 'gpt-5',
          max_output_tokens: 100,
          input: [{ role: 'user', content: [{ type: 'input_text', text: 'Solve this.' }] }],
          reasoning: { effort: 'high', summary: 'auto' },
        },
        'claude-sonnet-4-20250514',
      );

      expect(result.thinking).toEqual({ type: 'enabled', budget_tokens: 8192 });
    });

    it('should convert low reasoning effort', () => {
      const result = responsesToAnthropic.convertRequest(
        {
          model: 'gpt-5',
          max_output_tokens: 100,
          input: [{ role: 'user', content: [{ type: 'input_text', text: 'Quick question.' }] }],
          reasoning: { effort: 'low', summary: 'auto' },
        },
        'claude-sonnet-4-20250514',
      );

      expect(result.thinking).toEqual({ type: 'enabled', budget_tokens: 512 });
    });

    it('should convert function_call_output to tool_result', () => {
      const result = responsesToAnthropic.convertRequest(
        {
          model: 'gpt-5',
          max_output_tokens: 100,
          input: [
            {
              role: 'user',
              content: [
                { type: 'input_text', text: 'Weather?' },
                {
                  type: 'function_call_output',
                  call_id: 'call_abc',
                  output: 'Sunny, 72F',
                },
              ],
            },
          ],
        },
        'claude-sonnet-4-20250514',
      );

      const messages = result.messages as Array<Record<string, unknown>>;
      const userContent = messages[0].content as Array<Record<string, unknown>>;
      expect(userContent[1]).toEqual({
        type: 'tool_result',
        tool_use_id: 'call_abc',
        content: 'Sunny, 72F',
      });
    });

    it('should convert tools from Responses to Anthropic format', () => {
      const result = responsesToAnthropic.convertRequest(
        {
          model: 'gpt-5',
          max_output_tokens: 100,
          input: [{ role: 'user', content: [{ type: 'input_text', text: 'Search' }] }],
          tools: [
            {
              type: 'function',
              name: 'web_search',
              description: 'Search the web',
              parameters: {
                type: 'object',
                properties: { query: { type: 'string' } },
              },
            },
          ],
        },
        'claude-sonnet-4-20250514',
      );

      expect(result.tools).toEqual([
        {
          name: 'web_search',
          description: 'Search the web',
          input_schema: {
            type: 'object',
            properties: { query: { type: 'string' } },
          },
        },
      ]);
    });

    it('should convert tool_choice "required" to {type: "any"}', () => {
      const result = responsesToAnthropic.convertRequest(
        {
          model: 'gpt-5',
          max_output_tokens: 100,
          input: [{ role: 'user', content: [{ type: 'input_text', text: 'Hi' }] }],
          tool_choice: 'required',
        },
        'claude-sonnet-4-20250514',
      );

      expect(result.tool_choice).toEqual({ type: 'any' });
    });

    it('should convert input_image to Anthropic image block', () => {
      const result = responsesToAnthropic.convertRequest(
        {
          model: 'gpt-5',
          max_output_tokens: 100,
          input: [
            {
              role: 'user',
              content: [
                { type: 'input_text', text: 'Describe this:' },
                {
                  type: 'input_image',
                  source: { type: 'url', url: 'https://example.com/photo.jpg' },
                },
              ],
            },
          ],
        },
        'claude-sonnet-4-20250514',
      );

      const messages = result.messages as Array<Record<string, unknown>>;
      const userContent = messages[0].content as Array<Record<string, unknown>>;
      expect(userContent[0]).toEqual({ type: 'text', text: 'Describe this:' });
      expect(userContent[1]).toEqual({
        type: 'image',
        source: { type: 'url', url: 'https://example.com/photo.jpg' },
      });
    });

    it('should convert assistant output_text in input to Anthropic tool_use/text', () => {
      const result = responsesToAnthropic.convertRequest(
        {
          model: 'gpt-5',
          max_output_tokens: 100,
          input: [
            { role: 'user', content: [{ type: 'input_text', text: 'Hi' }] },
            {
              role: 'assistant',
              content: [
                { type: 'output_text', text: 'Hello!', annotations: [] },
              ],
            },
          ],
        },
        'claude-sonnet-4-20250514',
      );

      const messages = result.messages as Array<Record<string, unknown>>;
      const asstContent = messages[1].content as Array<Record<string, unknown>>;
      expect(asstContent[0]).toEqual({ type: 'text', text: 'Hello!' });
    });
  });

  describe('convertResponse', () => {
    it('should convert Anthropic message content to Responses output', () => {
      const result = responsesToAnthropic.convertResponse({
        id: 'msg_001',
        type: 'message',
        role: 'assistant',
        model: 'claude-sonnet-4-20250514',
        content: [
          { type: 'text', text: 'Here is the result.' },
          {
            type: 'tool_use',
            id: 'toolu_001',
            name: 'get_weather',
            input: { location: 'NYC' },
          },
        ],
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: { input_tokens: 25, output_tokens: 30 },
      });

      expect(result.id).toBe('msg_001');
      expect(result.status).toBe('completed');
      expect(result.output).toHaveLength(1);
      const output = result.output as Array<Record<string, unknown>>;
      const msg = output[0];
      expect(msg.type).toBe('message');
      expect(msg.role).toBe('assistant');
      const msgContent = msg.content as Array<Record<string, unknown>>;
      expect(msgContent[0]).toEqual({ type: 'output_text', text: 'Here is the result.', annotations: [] });
      expect(msgContent[1]).toMatchObject({
        type: 'function_call',
        call_id: 'toolu_001',
        name: 'get_weather',
      });
    });

    it('should handle error stop_reason as failed status', () => {
      const result = responsesToAnthropic.convertResponse({
        id: 'msg_err',
        type: 'message',
        role: 'assistant',
        model: 'claude-sonnet-4-20250514',
        content: [],
        stop_reason: 'error',
        stop_sequence: null,
        usage: { input_tokens: 5, output_tokens: 0 },
      });

      expect(result.status).toBe('failed');
    });
  });

  describe('convertStreamChunk', () => {
    let ctx: StreamContext;

    beforeEach(() => {
      ctx = responsesToAnthropic.createStreamContext();
    });

    it('should convert response.created to message_start', () => {
      const chunk = 'event: response.created\ndata: {"type":"response.created","response":{"id":"resp_001","object":"response","model":"gpt-5","status":"in_progress","output":[],"usage":null}}\n\n';

      const result = responsesToAnthropic.convertStreamChunk(chunk, ctx);

      expect(result).toContain('event: message_start');
      expect(result).toContain('"type":"message_start"');
      expect(result).toContain('"id":"resp_001"');
    });

    it('should convert response.content_part.added to content_block_start', () => {
      const chunk = 'event: response.content_part.added\ndata: {"type":"response.content_part.added","item_id":"msg_001","output_index":0,"content_index":0,"part":{"type":"output_text","text":"","annotations":[]}}\n\n';

      const result = responsesToAnthropic.convertStreamChunk(chunk, ctx);

      expect(result).toContain('event: content_block_start');
      expect(result).toContain('"type":"content_block_start"');
      expect(result).toContain('"type":"text"');
    });

    it('should convert response.text.delta to content_block_delta text_delta', () => {
      const chunk = 'event: response.text.delta\ndata: {"type":"response.text.delta","item_id":"msg_001","output_index":0,"content_index":0,"delta":"Hello!"}\n\n';

      const result = responsesToAnthropic.convertStreamChunk(chunk, ctx);

      expect(result).toContain('"type":"content_block_delta"');
      expect(result).toContain('"type":"text_delta"');
      expect(result).toContain('"text":"Hello!"');
    });

    it('should convert response.output_item.added (function_call) to content_block_start tool_use', () => {
      const chunk = 'event: response.output_item.added\ndata: {"type":"response.output_item.added","output_index":1,"item":{"type":"function_call","id":"fc_001","call_id":"call_001","name":"search","arguments":"","status":"in_progress"}}\n\n';

      const result = responsesToAnthropic.convertStreamChunk(chunk, ctx);

      expect(result).toContain('event: content_block_start');
      expect(result).toContain('"type":"tool_use"');
      expect(result).toContain('"name":"search"');
    });

    it('should convert response.output_text.delta to content_block_delta', () => {
      const chunk = 'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","item_id":"msg_001","output_index":0,"content_index":0,"delta":"World"}\n\n';

      const result = responsesToAnthropic.convertStreamChunk(chunk, ctx);

      expect(result).toContain('"type":"content_block_delta"');
      expect(result).toContain('"type":"text_delta"');
      expect(result).toContain('"text":"World"');
    });

    it('should convert response.function_call_arguments.delta to content_block_delta', () => {
      const chunk = 'event: response.function_call_arguments.delta\ndata: {"type":"response.function_call_arguments.delta","output_index":0,"delta":"{\\"query\\":\\"test\\"}"}\n\n';

      const result = responsesToAnthropic.convertStreamChunk(chunk, ctx);

      expect(result).toContain('"type":"content_block_delta"');
      expect(result).toContain('"type":"input_json_delta"');
      expect(result).toContain('"partial_json":');
    });

    it('should convert response.output_item.done to content_block_stop and message_delta', () => {
      const chunk = 'event: response.output_item.done\ndata: {"type":"response.output_item.done","output_index":0,"item":{"type":"message","id":"msg_001","status":"completed","role":"assistant","content":[{"type":"output_text","text":"Done","annotations":[]}]}}\n\n';

      const result = responsesToAnthropic.convertStreamChunk(chunk, ctx);

      expect(result).toContain('event: content_block_stop');
      expect(result).toContain('"type":"content_block_stop"');
      expect(result).toContain('event: message_delta');
      expect(result).toContain('"type":"message_delta"');
    });

    it('should convert response.completed to message_delta and message_stop', () => {
      const chunk = 'event: response.completed\ndata: {"type":"response.completed","response":{"id":"resp_001","object":"response","model":"gpt-5","status":"completed","output":[],"usage":{"input_tokens":10,"output_tokens":20}}}\n\n';

      const result = responsesToAnthropic.convertStreamChunk(chunk, ctx);

      expect(result).toContain('event: message_delta');
      expect(result).toContain('event: message_stop');
      expect(result).toContain('"type":"message_stop"');
    });
  });

  describe('convertError', () => {
    it('should map Responses error to Anthropic error format', () => {
      const result = responsesToAnthropic.convertError(
        400,
        JSON.stringify({
          type: 'error',
          error: { type: 'invalid_request_error', message: 'Invalid max_output_tokens' },
        }),
      );

      const parsed = JSON.parse(result.body);
      expect(parsed.error.type).toBe('invalid_request_error');
      expect(parsed.error.message).toBe('Invalid max_output_tokens');
    });
  });
});
