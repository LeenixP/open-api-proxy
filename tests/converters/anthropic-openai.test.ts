import { describe, it, expect, beforeEach } from 'vitest';
import {
  AnthropicToOpenAIChatConverter,
  OpenAIChatToAnthropicConverter,
  resetAnthropicToOpenAIStreamState,
  resetOpenAIToAnthropicStreamState,
} from '../../src/converters/anthropic-openai.js';

// ============================================================================
// AnthropicToOpenAIChatConverter
// ============================================================================

describe('AnthropicToOpenAIChatConverter', () => {
  const converter = AnthropicToOpenAIChatConverter;

  describe('convertRequest', () => {
    it('should convert basic text messages with max_tokens->max_completion_tokens', () => {
      const result = converter.convertRequest(
        {
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1024,
          messages: [
            { role: 'user', content: 'Hello, how are you?' },
          ],
        },
        'gpt-4o',
      );

      expect(result.model).toBe('gpt-4o');
      expect(result.max_completion_tokens).toBe(1024);
      expect(result.max_tokens).toBeUndefined();
      const messages = result.messages as Array<Record<string, unknown>>;
      expect(messages).toHaveLength(1);
      expect(messages[0]).toEqual({ role: 'user', content: 'Hello, how are you?' });
    });

    it('should convert system prompt to system message', () => {
      const result = converter.convertRequest(
        {
          model: 'claude-sonnet-4-20250514',
          max_tokens: 100,
          system: 'You are a helpful assistant.',
          messages: [
            { role: 'user', content: 'Hi' },
          ],
        },
        'gpt-4o',
      );

      const messages = result.messages as Array<Record<string, unknown>>;
      expect(messages).toHaveLength(2);
      expect(messages[0]).toEqual({ role: 'system', content: 'You are a helpful assistant.' });
      expect(messages[1]).toEqual({ role: 'user', content: 'Hi' });
    });

    it('should convert system array to system message', () => {
      const result = converter.convertRequest(
        {
          model: 'claude-sonnet-4-20250514',
          max_tokens: 100,
          system: [
            { type: 'text', text: 'You are helpful.' },
            { type: 'text', text: 'Be concise.' },
          ],
          messages: [{ role: 'user', content: 'Hi' }],
        },
        'gpt-4o',
      );

      const messages = result.messages as Array<Record<string, unknown>>;
      expect(messages[0]).toEqual({ role: 'system', content: 'You are helpful.\nBe concise.' });
    });

    it('should drop top_k', () => {
      const result = converter.convertRequest(
        {
          model: 'claude-sonnet-4-20250514',
          max_tokens: 100,
          temperature: 0.7,
          top_p: 0.9,
          top_k: 40,
          messages: [{ role: 'user', content: 'Hi' }],
        },
        'gpt-4o',
      );

      expect(result.temperature).toBe(0.7);
      expect(result.top_p).toBe(0.9);
      expect((result as Record<string, unknown>).top_k).toBeUndefined();
    });

    it('should convert single text content to string', () => {
      const result = converter.convertRequest(
        {
          model: 'claude-sonnet-4-20250514',
          max_tokens: 100,
          messages: [
            {
              role: 'user',
              content: [{ type: 'text', text: 'Hello world' }],
            },
          ],
        },
        'gpt-4o',
      );

      const messages = result.messages as Array<Record<string, unknown>>;
      expect(messages[0].content).toBe('Hello world');
    });

    it('should convert multi-part user content to array format', () => {
      const result = converter.convertRequest(
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
                    media_type: 'image/jpeg',
                    data: 'abc123',
                  },
                },
              ],
            },
          ],
        },
        'gpt-4o',
      );

      const messages = result.messages as Array<Record<string, unknown>>;
      const content = messages[0].content as Array<Record<string, unknown>>;
      expect(content).toHaveLength(2);
      expect(content[0]).toEqual({ type: 'text', text: 'Describe this image:' });
      expect(content[1]).toEqual({
        type: 'image_url',
        image_url: { url: 'data:image/jpeg;base64,abc123' },
      });
    });

    it('should convert assistant tool_use to tool_calls', () => {
      const result = converter.convertRequest(
        {
          model: 'claude-sonnet-4-20250514',
          max_tokens: 100,
          messages: [
            { role: 'user', content: "What is the weather in SF?" },
            {
              role: 'assistant',
              content: [
                { type: 'tool_use', id: 'toolu_001', name: 'get_weather', input: { location: 'SF' } },
              ],
            },
          ],
        },
        'gpt-4o',
      );

      const messages = result.messages as Array<Record<string, unknown>>;
      const assistantMsg = messages[1];
      expect(assistantMsg.role).toBe('assistant');
      expect(assistantMsg.content).toBeNull();
      const toolCalls = assistantMsg.tool_calls as Array<Record<string, unknown>>;
      expect(toolCalls).toHaveLength(1);
      expect(toolCalls[0].id).toBe('toolu_001');
      expect(toolCalls[0].type).toBe('function');
      expect(toolCalls[0].function).toEqual({ name: 'get_weather', arguments: '{"location":"SF"}' });
    });

    it('should convert user tool_result to role=tool message', () => {
      const result = converter.convertRequest(
        {
          model: 'claude-sonnet-4-20250514',
          max_tokens: 100,
          messages: [
            { role: 'user', content: "What is the weather in SF?" },
            {
              role: 'assistant',
              content: [
                { type: 'tool_use', id: 'toolu_001', name: 'get_weather', input: { location: 'SF' } },
              ],
            },
            {
              role: 'user',
              content: [
                { type: 'tool_result', tool_use_id: 'toolu_001', content: 'Sunny, 72F' },
              ],
            },
          ],
        },
        'gpt-4o',
      );

      const messages = result.messages as Array<Record<string, unknown>>;
      const toolMsg = messages[2];
      expect(toolMsg.role).toBe('tool');
      expect(toolMsg.tool_call_id).toBe('toolu_001');
      expect(toolMsg.content).toBe('Sunny, 72F');
    });

    it('should convert Anthropic tools to OpenAI function tools', () => {
      const result = converter.convertRequest(
        {
          model: 'claude-sonnet-4-20250514',
          max_tokens: 100,
          messages: [{ role: 'user', content: 'Hi' }],
          tools: [
            {
              name: 'get_weather',
              description: 'Get the weather for a location',
              input_schema: {
                type: 'object',
                properties: { location: { type: 'string' } },
                required: ['location'],
              },
            },
          ],
        },
        'gpt-4o',
      );

      const tools = result.tools as Array<Record<string, unknown>>;
      expect(tools).toHaveLength(1);
      expect(tools[0].type).toBe('function');
      expect(tools[0].function).toEqual({
        name: 'get_weather',
        description: 'Get the weather for a location',
        parameters: {
          type: 'object',
          properties: { location: { type: 'string' } },
          required: ['location'],
        },
      });
    });

    it('should convert tool_choice auto to "auto"', () => {
      const result = converter.convertRequest(
        {
          model: 'claude-sonnet-4-20250514',
          max_tokens: 100,
          messages: [{ role: 'user', content: 'Hi' }],
          tools: [{ name: 'test', input_schema: { type: 'object', properties: {} } }],
          tool_choice: { type: 'auto' },
        },
        'gpt-4o',
      );

      expect(result.tool_choice).toBe('auto');
    });

    it('should convert tool_choice any to "required"', () => {
      const result = converter.convertRequest(
        {
          model: 'claude-sonnet-4-20250514',
          max_tokens: 100,
          messages: [{ role: 'user', content: 'Hi' }],
          tools: [{ name: 'test', input_schema: { type: 'object', properties: {} } }],
          tool_choice: { type: 'any' },
        },
        'gpt-4o',
      );

      expect(result.tool_choice).toBe('required');
    });

    it('should convert tool_choice tool with name to function object', () => {
      const result = converter.convertRequest(
        {
          model: 'claude-sonnet-4-20250514',
          max_tokens: 100,
          messages: [{ role: 'user', content: 'Hi' }],
          tools: [{ name: 'get_weather', input_schema: { type: 'object', properties: {} } }],
          tool_choice: { type: 'tool', name: 'get_weather' },
        },
        'gpt-4o',
      );

      expect(result.tool_choice).toEqual({ type: 'function', function: { name: 'get_weather' } });
    });

    it('should convert stop_sequences to stop', () => {
      const result = converter.convertRequest(
        {
          model: 'claude-sonnet-4-20250514',
          max_tokens: 100,
          messages: [{ role: 'user', content: 'Hi' }],
          stop_sequences: ['END', 'STOP'],
        },
        'gpt-4o',
      );

      expect(result.stop).toEqual(['END', 'STOP']);
    });

    it('should convert thinking budget <=4000 to reasoning_effort low', () => {
      const result = converter.convertRequest(
        {
          model: 'claude-sonnet-4-20250514',
          max_tokens: 100,
          messages: [{ role: 'user', content: 'Hi' }],
          thinking: { type: 'enabled', budget_tokens: 2000 },
        },
        'gpt-4o',
      );

      expect(result.reasoning_effort).toBe('low');
    });

    it('should convert thinking budget <=16000 to reasoning_effort medium', () => {
      const result = converter.convertRequest(
        {
          model: 'claude-sonnet-4-20250514',
          max_tokens: 100,
          messages: [{ role: 'user', content: 'Hi' }],
          thinking: { type: 'enabled', budget_tokens: 8000 },
        },
        'gpt-4o',
      );

      expect(result.reasoning_effort).toBe('medium');
    });

    it('should convert thinking budget >16000 to reasoning_effort high', () => {
      const result = converter.convertRequest(
        {
          model: 'claude-sonnet-4-20250514',
          max_tokens: 100,
          messages: [{ role: 'user', content: 'Hi' }],
          thinking: { type: 'enabled', budget_tokens: 32000 },
        },
        'gpt-4o',
      );

      expect(result.reasoning_effort).toBe('high');
    });

    it('should pass through temperature and top_p', () => {
      const result = converter.convertRequest(
        {
          model: 'claude-sonnet-4-20250514',
          max_tokens: 100,
          messages: [{ role: 'user', content: 'Hi' }],
          temperature: 0.5,
          top_p: 0.8,
        },
        'gpt-4o',
      );

      expect(result.temperature).toBe(0.5);
      expect(result.top_p).toBe(0.8);
    });

    it('should pass through stream flag', () => {
      const result = converter.convertRequest(
        {
          model: 'claude-sonnet-4-20250514',
          max_tokens: 100,
          messages: [{ role: 'user', content: 'Hi' }],
          stream: true,
        },
        'gpt-4o',
      );

      expect(result.stream).toBe(true);
    });

    it('should handle string messages on user role directly', () => {
      const result = converter.convertRequest(
        {
          model: 'claude-sonnet-4-20250514',
          max_tokens: 100,
          messages: [
            { role: 'user', content: 'Hello' },
            { role: 'assistant', content: 'Hi there!' },
          ],
        },
        'gpt-4o',
      );

      const messages = result.messages as Array<Record<string, unknown>>;
      expect(messages).toHaveLength(2);
      expect(messages[0]).toEqual({ role: 'user', content: 'Hello' });
      expect(messages[1]).toEqual({ role: 'assistant', content: 'Hi there!' });
    });
  });

  describe('convertResponse', () => {
    it('should convert chat.completion to Anthropic message format', () => {
      const result = converter.convertResponse({
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1700000000,
        model: 'gpt-4o',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'Hello! How can I help?' },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      });

      expect(result.id).toBe('chatcmpl-123');
      expect(result.type).toBe('message');
      expect(result.role).toBe('assistant');
      expect(result.model).toBe('gpt-4o');
      expect(result.stop_reason).toBe('end_turn');
      expect(result.stop_sequence).toBeNull();
      expect(result.content).toEqual([{ type: 'text', text: 'Hello! How can I help?' }]);
      expect(result.usage).toEqual({ input_tokens: 10, output_tokens: 5 });
    });

    it('should convert tool_calls in response', () => {
      const result = converter.convertResponse({
        id: 'chatcmpl-456',
        object: 'chat.completion',
        created: 1700000000,
        model: 'gpt-4o',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: null,
              tool_calls: [
                {
                  id: 'call_abc',
                  type: 'function',
                  function: { name: 'get_weather', arguments: '{"location":"SF"}' },
                },
              ],
            },
            finish_reason: 'tool_calls',
          },
        ],
        usage: { prompt_tokens: 15, completion_tokens: 20, total_tokens: 35 },
      });

      expect(result.content).toHaveLength(1);
      expect(result.content[0]).toEqual({
        type: 'tool_use',
        id: 'call_abc',
        name: 'get_weather',
        input: { location: 'SF' },
      });
      expect(result.stop_reason).toBe('tool_use');
    });

    it('should map finish_reason length to stop_reason max_tokens', () => {
      const result = converter.convertResponse({
        id: 'chatcmpl-789',
        object: 'chat.completion',
        created: 1700000000,
        model: 'gpt-4o',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'ok' },
            finish_reason: 'length',
          },
        ],
      });

      expect(result.stop_reason).toBe('max_tokens');
    });

    it('should map usage tokens', () => {
      const result = converter.convertResponse({
        id: 'chatcmpl-999',
        object: 'chat.completion',
        created: 1700000000,
        model: 'gpt-4o',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'Answer' },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 50, completion_tokens: 100, total_tokens: 150 },
      });

      expect(result.usage).toEqual({ input_tokens: 50, output_tokens: 100 });
    });

    it('should handle content_filter finish_reason', () => {
      const result = converter.convertResponse({
        id: 'chatcmpl-000',
        object: 'chat.completion',
        created: 1700000000,
        model: 'gpt-4o',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: '' },
            finish_reason: 'content_filter',
          },
        ],
      });

      expect(result.stop_reason).toBe('end_turn');
    });

    it('should handle response without choices gracefully', () => {
      const result = converter.convertResponse({
        id: 'chatcmpl-empty',
        object: 'chat.completion',
        created: 1700000000,
        model: 'gpt-4o',
        choices: [],
      });

      expect(result.type).toBe('message');
      expect(result.content).toEqual([{ type: 'text', text: '' }]);
      expect(result.stop_reason).toBe('end_turn');
    });
  });

  describe('convertStreamChunk', () => {
    beforeEach(() => {
      resetAnthropicToOpenAIStreamState();
    });

    it('should handle content delta -> text_delta', () => {
      const result = converter.convertStreamChunk(
        'data: {"id":"chatcmpl-001","object":"chat.completion.chunk","created":1700000000,"model":"gpt-4o","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}',
      );
      expect(result).toBeTruthy();
      // First chunk should include message_start + content_block_start + content_block_delta
      expect(result).toContain('event: message_start');
      expect(result).toContain('event: content_block_start');
      expect(result).toContain('event: content_block_delta');
      expect(result).toContain('"type":"text_delta"');
      expect(result).toContain('"text":"Hello"');
    });

    it('should handle subsequent content delta (no message_start)', () => {
      // First chunk
      converter.convertStreamChunk(
        'data: {"id":"chatcmpl-001","object":"chat.completion.chunk","created":1700000000,"model":"gpt-4o","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}',
      );
      // Second chunk - should only have content_block_delta
      const result = converter.convertStreamChunk(
        'data: {"id":"chatcmpl-001","object":"chat.completion.chunk","created":1700000000,"model":"gpt-4o","choices":[{"index":0,"delta":{"content":" world"},"finish_reason":null}]}',
      );
      expect(result).toBeTruthy();
      expect(result).not.toContain('event: message_start');
      expect(result).not.toContain('event: content_block_start');
      expect(result).toContain('event: content_block_delta');
      expect(result).toContain('"text":" world"');
    });

    it('should handle tool_call delta -> input_json_delta', () => {
      const result = converter.convertStreamChunk(
        'data: {"id":"chatcmpl-002","object":"chat.completion.chunk","created":1700000000,"model":"gpt-4o","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"id":"call_xyz","type":"function","function":{"name":"get_weather","arguments":""}}]},"finish_reason":null}]}',
      );
      expect(result).toBeTruthy();
      expect(result).toContain('event: message_start');
      expect(result).toContain('event: content_block_start');
      expect(result).toContain('"type":"tool_use"');
      expect(result).toContain('"id":"call_xyz"');
      expect(result).toContain('"name":"get_weather"');
    });

    it('should handle tool_call arguments delta', () => {
      // First: tool call start
      converter.convertStreamChunk(
        'data: {"id":"chatcmpl-002","object":"chat.completion.chunk","created":1700000000,"model":"gpt-4o","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"id":"call_xyz","type":"function","function":{"name":"get_weather","arguments":""}}]},"finish_reason":null}]}',
      );
      // Second: arguments
      const result = converter.convertStreamChunk(
        'data: {"id":"chatcmpl-002","object":"chat.completion.chunk","created":1700000000,"model":"gpt-4o","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\\"location\\":\\"SF\\"}"}}]},"finish_reason":null}]}',
      );
      expect(result).toBeTruthy();
      expect(result).toContain('event: content_block_delta');
      expect(result).toContain('"type":"input_json_delta"');
      expect(result).toContain('"partial_json":"{\\"location\\":\\"SF\\"}"');
    });

    it('should handle finish_reason -> message_delta + message_stop', () => {
      // First: send some content
      converter.convertStreamChunk(
        'data: {"id":"chatcmpl-003","object":"chat.completion.chunk","created":1700000000,"model":"gpt-4o","choices":[{"index":0,"delta":{"content":"Hi"},"finish_reason":null}]}',
      );
      // Finish
      const result = converter.convertStreamChunk(
        'data: {"id":"chatcmpl-003","object":"chat.completion.chunk","created":1700000000,"model":"gpt-4o","choices":[{"index":0,"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":5,"completion_tokens":3,"total_tokens":8}}',
      );
      expect(result).toBeTruthy();
      expect(result).toContain('event: content_block_stop');
      expect(result).toContain('event: message_delta');
      expect(result).toContain('event: message_stop');
      expect(result).toContain('"stop_reason":"end_turn"');
    });

    it('should handle [DONE] -> message_stop', () => {
      // Setup state via a stream
      converter.convertStreamChunk(
        'data: {"id":"chatcmpl-004","object":"chat.completion.chunk","created":1700000000,"model":"gpt-4o","choices":[{"index":0,"delta":{"content":"Test"},"finish_reason":null}]}',
      );
      const result = converter.convertStreamChunk('data: [DONE]');
      expect(result).toBeTruthy();
      expect(result).toContain('event: message_stop');
      expect(result).toContain('"type":"message_stop"');
    });

    it('should return null for empty delta', () => {
      const result = converter.convertStreamChunk('');
      expect(result).toBeNull();
    });

    it('should return null for non-SSE content', () => {
      const result = converter.convertStreamChunk('garbage');
      expect(result).toBeNull();
    });

    it('should return null for chunk with empty choices', () => {
      const result = converter.convertStreamChunk(
        'data: {"id":"chatcmpl-005","object":"chat.completion.chunk","choices":[]}',
      );
      expect(result).toBeNull();
    });

    it('should handle multiple content blocks separating correctly', () => {
      // Start with text
      converter.convertStreamChunk(
        'data: {"id":"chatcmpl-006","object":"chat.completion.chunk","created":1700000000,"model":"gpt-4o","choices":[{"index":0,"delta":{"content":"Let me check."},"finish_reason":null}]}',
      );
      // Switch to tool_call
      const result = converter.convertStreamChunk(
        'data: {"id":"chatcmpl-006","object":"chat.completion.chunk","created":1700000000,"model":"gpt-4o","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"id":"call_sw","type":"function","function":{"name":"search","arguments":"query"}}]},"finish_reason":null}]}',
      );
      expect(result).toBeTruthy();
      // Text block should be stopped before tool_use starts
      expect(result).toContain('event: content_block_stop');
      expect(result).toContain('"type":"tool_use"');
    });
  });

  describe('convertError', () => {
    it('should map Anthropic permission_error to OpenAI invalid_request_error', () => {
      const result = converter.convertError(403, JSON.stringify({
        type: 'error',
        error: { type: 'permission_error', message: 'Insufficient permissions' },
      }));
      const body = JSON.parse(result.body);
      expect(body.error.type).toBe('invalid_request_error');
      expect(body.error.message).toBe('Insufficient permissions');
    });

    it('should map Anthropic authentication_error to OpenAI invalid_request_error', () => {
      const result = converter.convertError(401, JSON.stringify({
        type: 'error',
        error: { type: 'authentication_error', message: 'Invalid API key' },
      }));
      const body = JSON.parse(result.body);
      expect(body.error.type).toBe('invalid_request_error');
      expect(body.error.message).toBe('Invalid API key');
    });

    it('should map Anthropic rate_limit_error to OpenAI rate_limit_error', () => {
      const result = converter.convertError(429, JSON.stringify({
        type: 'error',
        error: { type: 'rate_limit_error', message: 'Too many requests' },
      }));
      const body = JSON.parse(result.body);
      expect(body.error.type).toBe('rate_limit_error');
    });

    it('should map Anthropic api_error to OpenAI server_error', () => {
      const result = converter.convertError(500, JSON.stringify({
        type: 'error',
        error: { type: 'api_error', message: 'Internal error' },
      }));
      const body = JSON.parse(result.body);
      expect(body.error.type).toBe('server_error');
    });

    it('should preserve status code', () => {
      const result = converter.convertError(503, JSON.stringify({
        type: 'error',
        error: { type: 'overloaded_error', message: 'Overloaded' },
      }));
      expect(result.status).toBe(503);
    });

    it('should handle unparseable error body', () => {
      const result = converter.convertError(500, 'plain error text');
      const body = JSON.parse(result.body);
      expect(body.error.type).toBe('server_error');
      expect(body.error.message).toBe('plain error text');
    });
  });
});

// ============================================================================
// OpenAIChatToAnthropicConverter
// ============================================================================

describe('OpenAIChatToAnthropicConverter', () => {
  const converter = OpenAIChatToAnthropicConverter;

  describe('convertRequest', () => {
    it('should convert system message to system block', () => {
      const result = converter.convertRequest(
        {
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: 'You are helpful.' },
            { role: 'user', content: 'Hi' },
          ],
        },
        'claude-sonnet-4-20250514',
      );

      expect(result.model).toBe('claude-sonnet-4-20250514');
      const system = result.system as Array<Record<string, unknown>>;
      expect(system).toHaveLength(1);
      expect(system[0]).toEqual({ type: 'text', text: 'You are helpful.' });
      const messages = result.messages as Array<Record<string, unknown>>;
      expect(messages).toHaveLength(1);
      expect(messages[0].role).toBe('user');
    });

    it('should convert string content to text content block', () => {
      const result = converter.convertRequest(
        {
          model: 'gpt-4o',
          messages: [{ role: 'user', content: 'Hello world' }],
        },
        'claude-sonnet-4-20250514',
      );

      const messages = result.messages as Array<Record<string, unknown>>;
      const content = messages[0].content as Array<Record<string, unknown>>;
      expect(content).toHaveLength(1);
      expect(content[0]).toEqual({ type: 'text', text: 'Hello world' });
    });

    it('should convert max_completion_tokens to max_tokens', () => {
      const result = converter.convertRequest(
        {
          model: 'gpt-4o',
          max_completion_tokens: 2048,
          messages: [{ role: 'user', content: 'Hi' }],
        },
        'claude-sonnet-4-20250514',
      );

      expect(result.max_tokens).toBe(2048);
      expect((result as Record<string, unknown>).max_completion_tokens).toBeUndefined();
    });

    it('should convert image_url to Anthropic image source (base64)', () => {
      const result = converter.convertRequest(
        {
          model: 'gpt-4o',
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: 'Describe this:' },
                {
                  type: 'image_url',
                  image_url: { url: 'data:image/png;base64,iVBORw0KGgo=' },
                },
              ],
            },
          ],
        },
        'claude-sonnet-4-20250514',
      );

      const messages = result.messages as Array<Record<string, unknown>>;
      const content = messages[0].content as Array<Record<string, unknown>>;
      expect(content).toHaveLength(2);
      expect(content[0]).toEqual({ type: 'text', text: 'Describe this:' });
      expect(content[1]).toEqual({
        type: 'image',
        source: { type: 'base64', media_type: 'image/png', data: 'iVBORw0KGgo=' },
      });
    });

    it('should convert tool_calls to tool_use content blocks', () => {
      const result = converter.convertRequest(
        {
          model: 'gpt-4o',
          messages: [
            { role: 'user', content: 'Weather in SF?' },
            {
              role: 'assistant',
              content: null,
              tool_calls: [
                {
                  id: 'call_abc',
                  type: 'function',
                  function: { name: 'get_weather', arguments: '{"location":"SF"}' },
                },
              ],
            },
          ],
        },
        'claude-sonnet-4-20250514',
      );

      const messages = result.messages as Array<Record<string, unknown>>;
      const assistantMsg = messages[1];
      const content = assistantMsg.content as Array<Record<string, unknown>>;
      expect(content).toHaveLength(1);
      expect(content[0]).toEqual({
        type: 'tool_use',
        id: 'call_abc',
        name: 'get_weather',
        input: { location: 'SF' },
      });
    });

    it('should convert role=tool message to tool_result block', () => {
      const result = converter.convertRequest(
        {
          model: 'gpt-4o',
          messages: [
            { role: 'user', content: 'Weather?' },
            {
              role: 'assistant',
              content: null,
              tool_calls: [
                {
                  id: 'call_001',
                  type: 'function',
                  function: { name: 'get_weather', arguments: '{"location":"NY"}' },
                },
              ],
            },
            { role: 'tool', tool_call_id: 'call_001', content: 'Cloudy, 60F' },
          ],
        },
        'claude-sonnet-4-20250514',
      );

      const messages = result.messages as Array<Record<string, unknown>>;
      const toolMsg = messages[2];
      expect(toolMsg.role).toBe('user');
      const content = toolMsg.content as Array<Record<string, unknown>>;
      expect(content).toHaveLength(1);
      expect(content[0]).toEqual({
        type: 'tool_result',
        tool_use_id: 'call_001',
        content: 'Cloudy, 60F',
      });
    });

    it('should convert OpenAI function tools to Anthropic tools', () => {
      const result = converter.convertRequest(
        {
          model: 'gpt-4o',
          messages: [{ role: 'user', content: 'Hi' }],
          tools: [
            {
              type: 'function',
              function: {
                name: 'search',
                description: 'Search the web',
                parameters: { type: 'object', properties: { q: { type: 'string' } } },
              },
            },
          ],
        },
        'claude-sonnet-4-20250514',
      );

      const tools = result.tools as Array<Record<string, unknown>>;
      expect(tools).toHaveLength(1);
      expect(tools[0]).toEqual({
        name: 'search',
        description: 'Search the web',
        input_schema: { type: 'object', properties: { q: { type: 'string' } } },
      });
    });

    it('should convert reasoning_effort low to thinking budget 4000', () => {
      const result = converter.convertRequest(
        {
          model: 'gpt-4o',
          messages: [{ role: 'user', content: 'Hi' }],
          reasoning_effort: 'low',
        },
        'claude-sonnet-4-20250514',
      );

      const thinking = result.thinking as Record<string, unknown>;
      expect(thinking).toEqual({ type: 'enabled', budget_tokens: 4000 });
    });

    it('should convert reasoning_effort medium to thinking budget 16000', () => {
      const result = converter.convertRequest(
        {
          model: 'gpt-4o',
          messages: [{ role: 'user', content: 'Hi' }],
          reasoning_effort: 'medium',
        },
        'claude-sonnet-4-20250514',
      );

      const thinking = result.thinking as Record<string, unknown>;
      expect(thinking).toEqual({ type: 'enabled', budget_tokens: 16000 });
    });

    it('should convert reasoning_effort high to thinking budget 32000', () => {
      const result = converter.convertRequest(
        {
          model: 'gpt-4o',
          messages: [{ role: 'user', content: 'Hi' }],
          reasoning_effort: 'high',
        },
        'claude-sonnet-4-20250514',
      );

      const thinking = result.thinking as Record<string, unknown>;
      expect(thinking).toEqual({ type: 'enabled', budget_tokens: 32000 });
    });

    it('should pass through temperature and top_p', () => {
      const result = converter.convertRequest(
        {
          model: 'gpt-4o',
          messages: [{ role: 'user', content: 'Hi' }],
          temperature: 0.3,
          top_p: 0.95,
        },
        'claude-sonnet-4-20250514',
      );

      expect(result.temperature).toBe(0.3);
      expect(result.top_p).toBe(0.95);
    });

    it('should convert tool_choice auto to {type: "auto"}', () => {
      const result = converter.convertRequest(
        {
          model: 'gpt-4o',
          messages: [{ role: 'user', content: 'Hi' }],
          tools: [{ type: 'function', function: { name: 'test', parameters: { type: 'object', properties: {} } } }],
          tool_choice: 'auto',
        },
        'claude-sonnet-4-20250514',
      );

      expect(result.tool_choice).toEqual({ type: 'auto' });
    });

    it('should convert tool_choice required to {type: "any"}', () => {
      const result = converter.convertRequest(
        {
          model: 'gpt-4o',
          messages: [{ role: 'user', content: 'Hi' }],
          tools: [{ type: 'function', function: { name: 'test', parameters: { type: 'object', properties: {} } } }],
          tool_choice: 'required',
        },
        'claude-sonnet-4-20250514',
      );

      expect(result.tool_choice).toEqual({ type: 'any' });
    });

    it('should convert tool_choice none by dropping tools', () => {
      const result = converter.convertRequest(
        {
          model: 'gpt-4o',
          messages: [{ role: 'user', content: 'Hi' }],
          tools: [{ type: 'function', function: { name: 'test', parameters: { type: 'object', properties: {} } } }],
          tool_choice: 'none',
        },
        'claude-sonnet-4-20250514',
      );

      expect(result.tools).toBeUndefined();
    });

    it('should convert stop string to stop_sequences array', () => {
      const result = converter.convertRequest(
        {
          model: 'gpt-4o',
          messages: [{ role: 'user', content: 'Hi' }],
          stop: 'END',
        },
        'claude-sonnet-4-20250514',
      );

      expect(result.stop_sequences).toEqual(['END']);
    });

    it('should convert stop array to stop_sequences', () => {
      const result = converter.convertRequest(
        {
          model: 'gpt-4o',
          messages: [{ role: 'user', content: 'Hi' }],
          stop: ['END', 'STOP'],
        },
        'claude-sonnet-4-20250514',
      );

      expect(result.stop_sequences).toEqual(['END', 'STOP']);
    });

    it('should handle system message with array content', () => {
      const result = converter.convertRequest(
        {
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: [
                { type: 'text', text: 'Part 1.' },
                { type: 'text', text: 'Part 2.' },
              ],
            },
            { role: 'user', content: 'Hi' },
          ],
        },
        'claude-sonnet-4-20250514',
      );

      const system = result.system as Array<Record<string, unknown>>;
      expect(system).toHaveLength(2);
      expect(system[0]).toEqual({ type: 'text', text: 'Part 1.' });
      expect(system[1]).toEqual({ type: 'text', text: 'Part 2.' });
    });

    it('should handle assistant message with both text content and tool_calls', () => {
      const result = converter.convertRequest(
        {
          model: 'gpt-4o',
          messages: [
            { role: 'user', content: 'Weather?' },
            {
              role: 'assistant',
              content: 'Let me check the weather.',
              tool_calls: [
                {
                  id: 'call_002',
                  type: 'function',
                  function: { name: 'get_weather', arguments: '{"location":"LA"}' },
                },
              ],
            },
          ],
        },
        'claude-sonnet-4-20250514',
      );

      const messages = result.messages as Array<Record<string, unknown>>;
      const content = messages[1].content as Array<Record<string, unknown>>;
      expect(content).toHaveLength(2);
      expect(content[0]).toEqual({ type: 'text', text: 'Let me check the weather.' });
      expect(content[1].type).toBe('tool_use');
      expect(content[1].name).toBe('get_weather');
    });
  });

  describe('convertResponse', () => {
    it('should convert Anthropic message to chat.completion', () => {
      const result = converter.convertResponse({
        id: 'msg_001',
        type: 'message',
        role: 'assistant',
        model: 'claude-sonnet-4-20250514',
        content: [{ type: 'text', text: 'Hello! How can I help you?' }],
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: { input_tokens: 15, output_tokens: 8 },
      });

      expect(result.id).toBe('msg_001');
      expect(result.object).toBe('chat.completion');
      expect(result.model).toBe('claude-sonnet-4-20250514');
      const choices = result.choices as Array<Record<string, unknown>>;
      expect(choices[0].message).toEqual({
        role: 'assistant',
        content: 'Hello! How can I help you?',
      });
      expect(choices[0].finish_reason).toBe('stop');
      expect(result.usage).toEqual({
        prompt_tokens: 15,
        completion_tokens: 8,
        total_tokens: 23,
      });
    });

    it('should convert tool_use to tool_calls', () => {
      const result = converter.convertResponse({
        id: 'msg_002',
        type: 'message',
        role: 'assistant',
        model: 'claude-sonnet-4-20250514',
        content: [
          { type: 'tool_use', id: 'toolu_abc', name: 'get_weather', input: { location: 'SF' } },
        ],
        stop_reason: 'tool_use',
        stop_sequence: null,
        usage: { input_tokens: 20, output_tokens: 15 },
      });

      const choices = result.choices as Array<Record<string, unknown>>;
      const msg = choices[0].message as Record<string, unknown>;
      expect(msg.content).toBeNull();
      const toolCalls = msg.tool_calls as Array<Record<string, unknown>>;
      expect(toolCalls).toHaveLength(1);
      expect(toolCalls[0].function).toEqual({ name: 'get_weather', arguments: '{"location":"SF"}' });
      expect(choices[0].finish_reason).toBe('tool_calls');
    });

    it('should handle max_tokens stop_reason', () => {
      const result = converter.convertResponse({
        id: 'msg_003',
        type: 'message',
        role: 'assistant',
        model: 'claude-sonnet-4-20250514',
        content: [{ type: 'text', text: 'Partial response...' }],
        stop_reason: 'max_tokens',
        stop_sequence: null,
        usage: { input_tokens: 10, output_tokens: 100 },
      });

      const choices = result.choices as Array<Record<string, unknown>>;
      expect(choices[0].finish_reason).toBe('length');
    });

    it('should handle mixed text and tool_use content', () => {
      const result = converter.convertResponse({
        id: 'msg_004',
        type: 'message',
        role: 'assistant',
        model: 'claude-sonnet-4-20250514',
        content: [
          { type: 'text', text: 'Sure, let me look that up.' },
          { type: 'tool_use', id: 'toolu_xyz', name: 'search', input: { query: 'weather' } },
        ],
        stop_reason: 'tool_use',
        stop_sequence: null,
        usage: { input_tokens: 12, output_tokens: 25 },
      });

      const choices = result.choices as Array<Record<string, unknown>>;
      const msg = choices[0].message as Record<string, unknown>;
      expect(msg.content).toBe('Sure, let me look that up.');
      const toolCalls = msg.tool_calls as Array<Record<string, unknown>>;
      expect(toolCalls).toHaveLength(1);
    });
  });

  describe('convertStreamChunk', () => {
    beforeEach(() => {
      resetOpenAIToAnthropicStreamState();
    });

    it('should convert message_start -> role delta', () => {
      const result = converter.convertStreamChunk(
        'event: message_start\ndata: {"type":"message_start","message":{"id":"msg_001","type":"message","role":"assistant","model":"claude-sonnet-4-20250514","content":[],"usage":{"input_tokens":10}}}',
      );
      expect(result).toBeTruthy();
      const parsed = JSON.parse(result!.replace(/^data: /, '').trim());
      expect(parsed.object).toBe('chat.completion.chunk');
      expect(parsed.choices[0].delta).toEqual({ role: 'assistant', content: '' });
      expect(parsed.choices[0].finish_reason).toBeNull();
    });

    it('should convert content_block_start (text) -> empty content delta', () => {
      // First need message_start for state
      converter.convertStreamChunk(
        'event: message_start\ndata: {"type":"message_start","message":{"id":"msg_002","type":"message","role":"assistant","model":"claude-sonnet-4-20250514","content":[]}}',
      );
      const result = converter.convertStreamChunk(
        'event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}',
      );
      expect(result).toBeTruthy();
      const parsed = JSON.parse(result!.replace(/^data: /, '').trim());
      expect(parsed.choices[0].delta.content).toBe('');
    });

    it('should convert content_block_start (tool_use) -> tool_call delta', () => {
      converter.convertStreamChunk(
        'event: message_start\ndata: {"type":"message_start","message":{"id":"msg_003","type":"message","role":"assistant","model":"claude-sonnet-4-20250514","content":[]}}',
      );
      const result = converter.convertStreamChunk(
        'event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"tool_use","id":"toolu_001","name":"get_weather","input":{}}}',
      );
      expect(result).toBeTruthy();
      const parsed = JSON.parse(result!.replace(/^data: /, '').trim());
      const toolCalls = parsed.choices[0].delta.tool_calls;
      expect(toolCalls).toHaveLength(1);
      expect(toolCalls[0].id).toBe('toolu_001');
      expect(toolCalls[0].function.name).toBe('get_weather');
    });

    it('should convert text_delta -> content delta', () => {
      converter.convertStreamChunk(
        'event: message_start\ndata: {"type":"message_start","message":{"id":"msg_004","type":"message","role":"assistant","model":"claude-sonnet-4-20250514","content":[]}}',
      );
      converter.convertStreamChunk(
        'event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}',
      );
      const result = converter.convertStreamChunk(
        'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello"}}',
      );
      expect(result).toBeTruthy();
      const parsed = JSON.parse(result!.replace(/^data: /, '').trim());
      expect(parsed.choices[0].delta.content).toBe('Hello');
    });

    it('should convert input_json_delta -> tool_call arguments delta', () => {
      converter.convertStreamChunk(
        'event: message_start\ndata: {"type":"message_start","message":{"id":"msg_005","type":"message","role":"assistant","model":"claude-sonnet-4-20250514","content":[]}}',
      );
      converter.convertStreamChunk(
        'event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"tool_use","id":"toolu_002","name":"search","input":{}}}',
      );
      const result = converter.convertStreamChunk(
        'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":"{\\"query\\":\\"weather\\"}"}}',
      );
      expect(result).toBeTruthy();
      const parsed = JSON.parse(result!.replace(/^data: /, '').trim());
      const tc = parsed.choices[0].delta.tool_calls[0];
      expect(tc.function.arguments).toBe('{"query":"weather"}');
    });

    it('should convert message_delta -> finish_reason + usage', () => {
      converter.convertStreamChunk(
        'event: message_start\ndata: {"type":"message_start","message":{"id":"msg_006","type":"message","role":"assistant","model":"claude-sonnet-4-20250514","content":[],"usage":{"input_tokens":10}}}',
      );
      converter.convertStreamChunk(
        'event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}',
      );
      converter.convertStreamChunk(
        'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hi"}}',
      );
      converter.convertStreamChunk(
        'event: content_block_stop\ndata: {"type":"content_block_stop","index":0}',
      );
      const result = converter.convertStreamChunk(
        'event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn","stop_sequence":null},"usage":{"output_tokens":5}}',
      );
      expect(result).toBeTruthy();
      const parsed = JSON.parse(result!.replace(/^data: /, '').trim());
      expect(parsed.choices[0].finish_reason).toBe('stop');
      expect(parsed.usage.completion_tokens).toBe(5);
    });

    it('should convert message_stop -> [DONE]', () => {
      converter.convertStreamChunk(
        'event: message_start\ndata: {"type":"message_start","message":{"id":"msg_007","type":"message","role":"assistant","model":"claude-sonnet-4-20250514","content":[]}}',
      );
      converter.convertStreamChunk(
        'event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}',
      );
      converter.convertStreamChunk(
        'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Done"}}',
      );
      converter.convertStreamChunk(
        'event: content_block_stop\ndata: {"type":"content_block_stop","index":0}',
      );
      converter.convertStreamChunk(
        'event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn","stop_sequence":null},"usage":{"output_tokens":2}}',
      );
      const result = converter.convertStreamChunk(
        'event: message_stop\ndata: {"type":"message_stop"}',
      );
      expect(result).toBe('data: [DONE]\n\n');
    });

    it('should convert error event', () => {
      const result = converter.convertStreamChunk(
        'event: error\ndata: {"type":"error","error":{"type":"overloaded_error","message":"Server overloaded"}}',
      );
      expect(result).toBeTruthy();
      const parsed = JSON.parse(result!.replace(/^data: /, '').trim());
      expect(parsed.error.type).toBe('overloaded_error');
    });

    it('should return null for content_block_stop when no state needed', () => {
      converter.convertStreamChunk(
        'event: message_start\ndata: {"type":"message_start","message":{"id":"msg_008","type":"message","role":"assistant","model":"claude-sonnet-4-20250514","content":[]}}',
      );
      const result = converter.convertStreamChunk(
        'event: content_block_stop\ndata: {"type":"content_block_stop","index":0}',
      );
      expect(result).toBeNull();
    });

    it('should return null for empty chunk', () => {
      const result = converter.convertStreamChunk('');
      expect(result).toBeNull();
    });

    it('should return null for ping event', () => {
      const result = converter.convertStreamChunk(
        'event: ping\ndata: {}',
      );
      expect(result).toBeNull();
    });
  });

  describe('convertError', () => {
    it('should map OpenAI invalid_request_error to Anthropic invalid_request_error', () => {
      const result = converter.convertError(400, JSON.stringify({
        error: { type: 'invalid_request_error', message: 'Bad request' },
      }));
      const body = JSON.parse(result.body);
      expect(body.error.type).toBe('invalid_request_error');
      expect(body.error.message).toBe('Bad request');
    });

    it('should map OpenAI rate_limit_error to Anthropic rate_limit_error', () => {
      const result = converter.convertError(429, JSON.stringify({
        error: { type: 'rate_limit_error', message: 'Rate limited' },
      }));
      const body = JSON.parse(result.body);
      expect(body.error.type).toBe('rate_limit_error');
    });

    it('should map OpenAI authentication_error', () => {
      const result = converter.convertError(401, JSON.stringify({
        error: { type: 'authentication_error', message: 'Invalid key' },
      }));
      const body = JSON.parse(result.body);
      expect(body.error.type).toBe('authentication_error');
    });

    it('should map OpenAI server_error to Anthropic api_error', () => {
      const result = converter.convertError(500, JSON.stringify({
        error: { type: 'server_error', message: 'Internal error' },
      }));
      const body = JSON.parse(result.body);
      expect(body.error.type).toBe('api_error');
    });

    it('should preserve status code', () => {
      const result = converter.convertError(503, JSON.stringify({
        error: { type: 'server_error', message: 'Down' },
      }));
      expect(result.status).toBe(503);
    });

    it('should handle unparseable error body', () => {
      const result = converter.convertError(500, 'raw error');
      const body = JSON.parse(result.body);
      expect(body.error.type).toBe('api_error');
      expect(body.error.message).toBe('raw error');
    });
  });
});
