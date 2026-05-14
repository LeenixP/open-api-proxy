import { describe, it, expect, beforeEach } from 'vitest';
import {
  OpenAIChatToResponsesConverter,
  ResponsesToOpenAIChatConverter,
} from '../../src/converters/openai-responses.js';
import type { StreamContext } from '../../src/types.js';

// ============================================================================
// OpenAIChatToResponsesConverter
// ============================================================================

describe('OpenAIChatToResponsesConverter', () => {
  const converter = new OpenAIChatToResponsesConverter();

  describe('convertRequest', () => {
    it('should convert basic messages to input format', () => {
      const result = converter.convertRequest(
        {
          model: 'gpt-4',
          messages: [
            { role: 'user', content: 'Hello' },
          ],
        },
        'gpt-4',
      );
      expect(result.model).toBe('gpt-4');
      expect(result.input).toEqual([
        { role: 'user', content: [{ type: 'input_text', text: 'Hello' }] },
      ]);
    });

    it('should extract system message to instructions', () => {
      const result = converter.convertRequest(
        {
          messages: [
            { role: 'system', content: 'You are a helpful assistant.' },
            { role: 'user', content: 'Hi' },
          ],
        },
        'gpt-4',
      );
      expect(result.instructions).toBe('You are a helpful assistant.');
      expect(result.input).toHaveLength(1);
      expect(result.input?.[0]).toEqual({
        role: 'user',
        content: [{ type: 'input_text', text: 'Hi' }],
      });
    });

    it('should convert max_completion_tokens to max_output_tokens', () => {
      const result = converter.convertRequest(
        {
          messages: [{ role: 'user', content: 'Hi' }],
          max_completion_tokens: 500,
        },
        'gpt-4',
      );
      expect(result.max_output_tokens).toBe(500);
    });

    it('should fall back to max_tokens for max_output_tokens', () => {
      const result = converter.convertRequest(
        {
          messages: [{ role: 'user', content: 'Hi' }],
          max_tokens: 256,
        },
        'gpt-4',
      );
      expect(result.max_output_tokens).toBe(256);
    });

    it('should prefer max_completion_tokens over max_tokens', () => {
      const result = converter.convertRequest(
        {
          messages: [{ role: 'user', content: 'Hi' }],
          max_tokens: 256,
          max_completion_tokens: 512,
        },
        'gpt-4',
      );
      expect(result.max_output_tokens).toBe(512);
    });

    it('should convert user text content to input_text', () => {
      const result = converter.convertRequest(
        {
          messages: [{ role: 'user', content: 'Tell me a story.' }],
        },
        'gpt-4',
      );
      expect(result.input).toEqual([
        {
          role: 'user',
          content: [{ type: 'input_text', text: 'Tell me a story.' }],
        },
      ]);
    });

    it('should convert user array content with image_url', () => {
      const result = converter.convertRequest(
        {
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: 'What is in this image?' },
                {
                  type: 'image_url',
                  image_url: { url: 'https://example.com/photo.jpg' },
                },
              ],
            },
          ],
        },
        'gpt-4',
      );
      expect(result.input).toEqual([
        {
          role: 'user',
          content: [
            { type: 'input_text', text: 'What is in this image?' },
            {
              type: 'input_image',
              image_url: { url: 'https://example.com/photo.jpg' },
            },
          ],
        },
      ]);
    });

    it('should convert assistant with text and tool_calls', () => {
      const result = converter.convertRequest(
        {
          messages: [
            { role: 'user', content: 'What is the weather in Tokyo?' },
            {
              role: 'assistant',
              content: 'Let me check the weather.',
              tool_calls: [
                {
                  id: 'call_abc123',
                  type: 'function',
                  function: {
                    name: 'get_weather',
                    arguments: '{"location":"Tokyo"}',
                  },
                },
              ],
            },
          ],
        },
        'gpt-4',
      );
      const input = result.input as Array<Record<string, unknown>>;
      expect(input).toHaveLength(3); // user + assistant + function_call

      // user
      expect(input[0]).toEqual({
        role: 'user',
        content: [{ type: 'input_text', text: 'What is the weather in Tokyo?' }],
      });

      // assistant with text content
      expect(input[1]).toEqual({
        role: 'assistant',
        content: [
          {
            type: 'output_text',
            text: 'Let me check the weather.',
            annotations: [],
          },
        ],
      });

      // function_call
      expect(input[2]).toEqual({
        type: 'function_call',
        call_id: 'call_abc123',
        name: 'get_weather',
        arguments: '{"location":"Tokyo"}',
      });
    });

    it('should convert assistant with tool_calls only (null content)', () => {
      const result = converter.convertRequest(
        {
          messages: [
            { role: 'user', content: 'Weather in Paris?' },
            {
              role: 'assistant',
              content: null,
              tool_calls: [
                {
                  id: 'call_xyz',
                  type: 'function',
                  function: { name: 'get_weather', arguments: '{"location":"Paris"}' },
                },
              ],
            },
          ],
        },
        'gpt-4',
      );
      const input = result.input as Array<Record<string, unknown>>;
      expect(input).toHaveLength(2); // user + function_call only (no assistant content)
      expect(input[1]).toEqual({
        type: 'function_call',
        call_id: 'call_xyz',
        name: 'get_weather',
        arguments: '{"location":"Paris"}',
      });
    });

    it('should convert role=tool to function_call_output', () => {
      const result = converter.convertRequest(
        {
          messages: [
            { role: 'user', content: 'Weather?' },
            {
              role: 'assistant',
              content: null,
              tool_calls: [
                {
                  id: 'call_1',
                  type: 'function',
                  function: { name: 'get_weather', arguments: '{}' },
                },
              ],
            },
            { role: 'tool', tool_call_id: 'call_1', content: 'Sunny, 25C' },
          ],
        },
        'gpt-4',
      );
      const input = result.input as Array<Record<string, unknown>>;
      const toolItem = input.find((i) => i.type === 'function_call_output');
      expect(toolItem).toBeDefined();
      expect(toolItem).toEqual({
        type: 'function_call_output',
        call_id: 'call_1',
        output: 'Sunny, 25C',
      });
    });

    it('should convert tools array', () => {
      const result = converter.convertRequest(
        {
          messages: [{ role: 'user', content: 'Hi' }],
          tools: [
            {
              type: 'function',
              function: {
                name: 'get_weather',
                description: 'Get current weather',
                parameters: { type: 'object', properties: {} },
              },
            },
          ],
        },
        'gpt-4',
      );
      expect(result.tools).toEqual([
        {
          type: 'function',
          name: 'get_weather',
          description: 'Get current weather',
          parameters: { type: 'object', properties: {} },
        },
      ]);
    });

    it('should convert reasoning_effort to reasoning', () => {
      const result = converter.convertRequest(
        {
          messages: [{ role: 'user', content: 'Explain quantum computing.' }],
          reasoning_effort: 'high',
        },
        'gpt-4',
      );
      expect(result.reasoning).toEqual({ effort: 'high', summary: 'auto' });
    });

    it('should pass through temperature, top_p, stop, stream', () => {
      const result = converter.convertRequest(
        {
          messages: [{ role: 'user', content: 'Hi' }],
          temperature: 0.7,
          top_p: 0.9,
          stop: ['\n\n'],
          stream: true,
        },
        'gpt-4',
      );
      expect(result.temperature).toBe(0.7);
      expect(result.top_p).toBe(0.9);
      expect(result.stop).toEqual(['\n\n']);
      expect(result.stream).toBe(true);
    });
  });

  describe('convertResponse', () => {
    it('should convert Responses output message to chat completion', () => {
      const result = converter.convertResponse({
        id: 'resp_abc',
        object: 'response',
        model: 'gpt-4',
        status: 'completed',
        output: [
          {
            id: 'msg_1',
            type: 'message',
            role: 'assistant',
            content: [
              {
                type: 'output_text',
                text: 'Hello! How can I help you?',
                annotations: [],
              },
            ],
          },
        ],
        usage: {
          input_tokens: 10,
          output_tokens: 15,
          total_tokens: 25,
        },
      });
      expect(result.object).toBe('chat.completion');
      expect(result.model).toBe('gpt-4');
      const choices = result.choices as Array<Record<string, unknown>>;
      expect(choices).toHaveLength(1);
      expect(choices[0].finish_reason).toBe('stop');
      expect(choices[0].message).toEqual({
        role: 'assistant',
        content: 'Hello! How can I help you?',
      });
    });

    it('should convert function_call to tool_calls', () => {
      const result = converter.convertResponse({
        id: 'resp_func',
        object: 'response',
        model: 'gpt-4',
        status: 'completed',
        output: [
          {
            id: 'msg_1',
            type: 'message',
            role: 'assistant',
            content: [],
          },
          {
            id: 'fc_1',
            type: 'function_call',
            call_id: 'call_abc',
            name: 'get_weather',
            arguments: '{"location":"Tokyo"}',
          },
        ],
      });
      const choices = result.choices as Array<Record<string, unknown>>;
      const message = choices[0].message as Record<string, unknown>;
      expect(message.content).toBeNull();
      expect(message.tool_calls).toEqual([
        {
          id: 'call_abc',
          type: 'function',
          function: {
            name: 'get_weather',
            arguments: '{"location":"Tokyo"}',
          },
        },
      ]);
    });

    it('should map usage tokens', () => {
      const result = converter.convertResponse({
        id: 'resp_usage',
        object: 'response',
        model: 'gpt-4',
        status: 'completed',
        output: [],
        usage: {
          input_tokens: 50,
          output_tokens: 100,
          total_tokens: 150,
        },
      });
      expect(result.usage).toEqual({
        prompt_tokens: 50,
        completion_tokens: 100,
        total_tokens: 150,
      });
    });

    it('should handle text from multiple output_text parts', () => {
      const result = converter.convertResponse({
        id: 'resp_multi',
        object: 'response',
        model: 'gpt-4',
        status: 'completed',
        output: [
          {
            id: 'msg_1',
            type: 'message',
            role: 'assistant',
            content: [
              { type: 'output_text', text: 'Hello ', annotations: [] },
              { type: 'output_text', text: 'World!', annotations: [] },
            ],
          },
        ],
      });
      const choices = result.choices as Array<Record<string, unknown>>;
      expect((choices[0].message as Record<string, unknown>).content).toBe('Hello World!');
    });
  });

  describe('convertStreamChunk', () => {
    let ctx: StreamContext;

    beforeEach(() => {
      ctx = converter.createStreamContext();
    });

    it('should emit response.created on first delta with role', () => {
      const chunk = 'data: {"id":"chatcmpl-1","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"role":"assistant"},"finish_reason":null}]}';
      const result = converter.convertStreamChunk(chunk, ctx);
      expect(result).toBeDefined();
      expect(result).toContain('response.created');
    });

    it('should emit response.text.delta for content delta', () => {
      // First chunk to trigger created
      converter.convertStreamChunk(
        'data: {"id":"chatcmpl-1","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"role":"assistant"},"finish_reason":null}]}', ctx);
      const result = converter.convertStreamChunk(
        'data: {"id":"chatcmpl-1","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":"Hello world"},"finish_reason":null}]}', ctx);
      expect(result).toBeDefined();
      expect(result).toContain('response.text.delta');
      expect(result).toContain('Hello world');
    });

    it('should emit output_item.added for function_call tool name', () => {
      // Setup: trigger created first
      converter.convertStreamChunk(
        'data: {"id":"chatcmpl-1","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"role":"assistant"},"finish_reason":null}]}', ctx);
      const result = converter.convertStreamChunk(
        'data: {"id":"chatcmpl-1","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"id":"call_1","type":"function","function":{"name":"get_weather","arguments":""}}]},"finish_reason":null}]}', ctx);
      expect(result).toBeDefined();
      expect(result).toContain('response.output_item.added');
      expect(result).toContain('function_call');
      expect(result).toContain('get_weather');
    });

    it('should emit function_call_arguments.delta for argument chunks', () => {
      // Setup
      converter.convertStreamChunk(
        'data: {"id":"chatcmpl-1","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"role":"assistant"},"finish_reason":null}]}', ctx);
      converter.convertStreamChunk(
        'data: {"id":"chatcmpl-1","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"id":"call_1","type":"function","function":{"name":"get_weather","arguments":""}}]},"finish_reason":null}]}', ctx);
      const result = converter.convertStreamChunk(
        'data: {"id":"chatcmpl-1","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\\"location\\":\\"Tokyo\\"}"}}]},"finish_reason":null}]}', ctx);
      expect(result).toBeDefined();
      expect(result).toContain('response.function_call_arguments.delta');
    });

    it('should emit response.completed on finish_reason', () => {
      // Setup: trigger created
      converter.convertStreamChunk(
        'data: {"id":"chatcmpl-1","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"role":"assistant"},"finish_reason":null}]}', ctx);
      const result = converter.convertStreamChunk(
        'data: {"id":"chatcmpl-1","object":"chat.completion.chunk","choices":[{"index":0,"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":10,"completion_tokens":20,"total_tokens":30}}', ctx);
      expect(result).toBeDefined();
      expect(result).toContain('response.completed');
    });

    it('should return null for [DONE] chunk', () => {
      const result = converter.convertStreamChunk('data: [DONE]', ctx);
      expect(result).toBeNull();
    });

    it('should return null for unrecognized chunks', () => {
      const result = converter.convertStreamChunk(
        'data: {"unknown":"format"}', ctx);
      expect(result).toBeNull();
    });
  });

  describe('convertError', () => {
    it('should pass through error status and body', () => {
      const result = converter.convertError(400, 'Bad request');
      expect(result).toEqual({ status: 400, body: 'Bad request' });
    });
  });
});

// ============================================================================
// ResponsesToOpenAIChatConverter
// ============================================================================

describe('ResponsesToOpenAIChatConverter', () => {
  const converter = new ResponsesToOpenAIChatConverter();

  describe('convertRequest', () => {
    it('should convert input to messages', () => {
      const result = converter.convertRequest(
        {
          model: 'gpt-4',
          input: [
            { role: 'user', content: 'Hello' },
          ],
        },
        'gpt-4',
      );
      expect(result.model).toBe('gpt-4');
      expect(result.messages).toEqual([
        { role: 'user', content: 'Hello' },
      ]);
    });

    it('should convert instructions to system message', () => {
      const result = converter.convertRequest(
        {
          instructions: 'You are helpful.',
          input: [{ role: 'user', content: 'Hi' }],
        },
        'gpt-4',
      );
      const msgs = result.messages as Array<Record<string, unknown>>;
      expect(msgs).toHaveLength(2);
      expect(msgs[0]).toEqual({ role: 'system', content: 'You are helpful.' });
      expect(msgs[1]).toEqual({ role: 'user', content: 'Hi' });
    });

    it('should convert input_text to text content', () => {
      const result = converter.convertRequest(
        {
          input: [
            {
              role: 'user',
              content: [
                { type: 'input_text', text: 'Describe this' },
                {
                  type: 'input_image',
                  image_url: { url: 'https://example.com/img.png' },
                },
              ],
            },
          ],
        },
        'gpt-4',
      );
      const msgs = result.messages as Array<Record<string, unknown>>;
      expect(msgs).toHaveLength(1);
      expect(msgs[0]).toEqual({
        role: 'user',
        content: [
          { type: 'text', text: 'Describe this' },
          { type: 'image_url', image_url: { url: 'https://example.com/img.png' } },
        ],
      });
    });

    it('should convert function_call to tool_calls', () => {
      const result = converter.convertRequest(
        {
          input: [
            { role: 'user', content: 'Weather?' },
            { role: 'assistant', content: [] },
            {
              type: 'function_call',
              call_id: 'call_abc',
              name: 'get_weather',
              arguments: '{"location":"Tokyo"}',
            },
          ],
        },
        'gpt-4',
      );
      const msgs = result.messages as Array<Record<string, unknown>>;
      const assistantMsg = msgs[1] as Record<string, unknown>;
      expect(assistantMsg.role).toBe('assistant');
      expect(assistantMsg.tool_calls).toEqual([
        {
          id: 'call_abc',
          type: 'function',
          function: {
            name: 'get_weather',
            arguments: '{"location":"Tokyo"}',
          },
        },
      ]);
    });

    it('should convert function_call_output to role=tool', () => {
      const result = converter.convertRequest(
        {
          input: [
            { role: 'user', content: 'Check weather' },
            {
              type: 'function_call_output',
              call_id: 'call_xyz',
              output: 'Sunny, 25C',
            },
          ],
        },
        'gpt-4',
      );
      const msgs = result.messages as Array<Record<string, unknown>>;
      expect(msgs).toHaveLength(2);
      expect(msgs[1]).toEqual({
        role: 'tool',
        tool_call_id: 'call_xyz',
        content: 'Sunny, 25C',
      });
    });

    it('should convert max_output_tokens to max_completion_tokens', () => {
      const result = converter.convertRequest(
        {
          input: [{ role: 'user', content: 'Hi' }],
          max_output_tokens: 1000,
        },
        'gpt-4',
      );
      expect(result.max_completion_tokens).toBe(1000);
    });

    it('should convert reasoning to reasoning_effort', () => {
      const result = converter.convertRequest(
        {
          input: [{ role: 'user', content: 'Explain QM' }],
          reasoning: { effort: 'high', summary: 'auto' },
        },
        'gpt-4',
      );
      expect(result.reasoning_effort).toBe('high');
    });

    it('should pass through temperature, top_p, stop, stream', () => {
      const result = converter.convertRequest(
        {
          input: [{ role: 'user', content: 'Hi' }],
          temperature: 0.5,
          top_p: 0.8,
          stop: ['END'],
          stream: true,
        },
        'gpt-4',
      );
      expect(result.temperature).toBe(0.5);
      expect(result.top_p).toBe(0.8);
      expect(result.stop).toEqual(['END']);
      expect(result.stream).toBe(true);
    });

    it('should convert tools back to Chat format', () => {
      const result = converter.convertRequest(
        {
          input: [{ role: 'user', content: 'Hi' }],
          tools: [
            {
              type: 'function',
              name: 'search',
              description: 'Search the web',
              parameters: { type: 'object', properties: { query: { type: 'string' } } },
            },
          ],
        },
        'gpt-4',
      );
      expect(result.tools).toEqual([
        {
          type: 'function',
          function: {
            name: 'search',
            description: 'Search the web',
            parameters: { type: 'object', properties: { query: { type: 'string' } } },
          },
        },
      ]);
    });
  });

  describe('convertResponse', () => {
    it('should convert chat completion message to Responses output', () => {
      const result = converter.convertResponse({
        id: 'chatcmpl_123',
        object: 'chat.completion',
        model: 'gpt-4',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'Hello! How can I assist?',
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 15,
          total_tokens: 25,
        },
      });
      expect(result.object).toBe('response');
      expect(result.status).toBe('completed');
      expect(result.model).toBe('gpt-4');
      const output = result.output as Array<Record<string, unknown>>;
      expect(output).toHaveLength(1);
      expect(output[0].type).toBe('message');
      expect((output[0].content as Array<Record<string, unknown>>)[0]).toEqual({
        type: 'output_text',
        text: 'Hello! How can I assist?',
        annotations: [],
      });
      expect(result.usage).toEqual({
        input_tokens: 10,
        output_tokens: 15,
        total_tokens: 25,
      });
    });

    it('should convert chat completion with tool_calls to function_call items', () => {
      const result = converter.convertResponse({
        id: 'chatcmpl_456',
        object: 'chat.completion',
        model: 'gpt-4',
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
                  function: {
                    name: 'get_weather',
                    arguments: '{"location":"Tokyo"}',
                  },
                },
              ],
            },
            finish_reason: 'stop',
          },
        ],
      });
      const output = result.output as Array<Record<string, unknown>>;
      expect(output).toHaveLength(1);
      expect(output[0]).toMatchObject({
        type: 'function_call',
        call_id: 'call_abc',
        name: 'get_weather',
        arguments: '{"location":"Tokyo"}',
      });
    });

    it('should convert completion with both text and tool_calls', () => {
      const result = converter.convertResponse({
        id: 'chatcmpl_789',
        object: 'chat.completion',
        model: 'gpt-4',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'Let me check that for you.',
              tool_calls: [
                {
                  id: 'call_def',
                  type: 'function',
                  function: { name: 'search', arguments: '{"q":"weather"}' },
                },
              ],
            },
            finish_reason: 'stop',
          },
        ],
      });
      const output = result.output as Array<Record<string, unknown>>;
      expect(output).toHaveLength(2);
      expect(output[0].type).toBe('message');
      expect(output[1].type).toBe('function_call');
    });
  });

  describe('convertStreamChunk', () => {
    let ctx: StreamContext;

    beforeEach(() => {
      ctx = converter.createStreamContext();
    });

    it('should convert response.created to role delta', () => {
      const result = converter.convertStreamChunk(
        'data: {"type":"response.created","response":{"id":"resp_1","model":"gpt-4"}}', ctx);
      expect(result).toBeDefined();
      const parsed = JSON.parse(result!.replace(/^data: /, '').trim());
      expect(parsed.object).toBe('chat.completion.chunk');
      expect(parsed.choices[0].delta.role).toBe('assistant');
    });

    it('should convert response.text.delta to content delta', () => {
      // Setup: emit created first
      converter.convertStreamChunk(
        'data: {"type":"response.created","response":{"id":"resp_1"}}', ctx);
      const result = converter.convertStreamChunk(
        'data: {"type":"response.text.delta","delta":"Hello world"}', ctx);
      expect(result).toBeDefined();
      const parsed = JSON.parse(result!.replace(/^data: /, '').trim());
      expect(parsed.choices[0].delta.content).toBe('Hello world');
    });

    it('should convert response.output_text.delta to content delta', () => {
      converter.convertStreamChunk(
        'data: {"type":"response.created","response":{"id":"resp_2"}}', ctx);
      const result = converter.convertStreamChunk(
        'data: {"type":"response.output_text.delta","delta":"Test content"}', ctx);
      expect(result).toBeDefined();
      const parsed = JSON.parse(result!.replace(/^data: /, '').trim());
      expect(parsed.choices[0].delta.content).toBe('Test content');
    });

    it('should convert function_call output_item.added to tool_call delta', () => {
      converter.convertStreamChunk(
        'data: {"type":"response.created","response":{"id":"resp_3"}}', ctx);
      const result = converter.convertStreamChunk(
        'data: {"type":"response.output_item.added","item":{"id":"item_fc_1","type":"function_call","name":"get_weather","arguments":"","status":"in_progress"}}', ctx);
      expect(result).toBeDefined();
      const parsed = JSON.parse(result!.replace(/^data: /, '').trim());
      const tc = parsed.choices[0].delta.tool_calls[0];
      expect(tc.type).toBe('function');
      expect(tc.function.name).toBe('get_weather');
    });

    it('should convert function_call_arguments.delta to tool_call arguments delta', () => {
      converter.convertStreamChunk(
        'data: {"type":"response.created","response":{"id":"resp_4"}}', ctx);
      converter.convertStreamChunk(
        'data: {"type":"response.output_item.added","item":{"id":"item_fc_1","type":"function_call","name":"get_weather","arguments":"","status":"in_progress"}}', ctx);
      const result = converter.convertStreamChunk(
        'data: {"type":"response.function_call_arguments.delta","delta":"{\\"location\\":\\"Tokyo\\"}"}', ctx);
      expect(result).toBeDefined();
      const parsed = JSON.parse(result!.replace(/^data: /, '').trim());
      expect(parsed.choices[0].delta.tool_calls[0].function.arguments).toBe(
        '{"location":"Tokyo"}',
      );
    });

    it('should convert response.completed to finish_reason + usage', () => {
      converter.convertStreamChunk(
        'data: {"type":"response.created","response":{"id":"resp_5"}}', ctx);
      const result = converter.convertStreamChunk(
        'data: {"type":"response.completed","response":{"id":"resp_5","model":"gpt-4","usage":{"input_tokens":10,"output_tokens":20,"total_tokens":30}}}', ctx);
      expect(result).toBeDefined();
      const parsed = JSON.parse(result!.replace(/^data: /, '').trim());
      expect(parsed.choices[0].finish_reason).toBe('stop');
      expect(parsed.usage).toEqual({
        prompt_tokens: 10,
        completion_tokens: 20,
        total_tokens: 30,
      });
    });

    it('should return null for [DONE] chunk', () => {
      const result = converter.convertStreamChunk('data: [DONE]', ctx);
      expect(result).toBeNull();
    });

    it('should return null for unrecognized event types', () => {
      converter.convertStreamChunk(
        'data: {"type":"response.created","response":{"id":"resp_6"}}', ctx);
      const result = converter.convertStreamChunk(
        'data: {"type":"response.unknown.event","data":"ignored"}', ctx);
      expect(result).toBeNull();
    });
  });

  describe('convertError', () => {
    it('should pass through error status and body', () => {
      const result = converter.convertError(500, 'Internal error');
      expect(result).toEqual({ status: 500, body: 'Internal error' });
    });
  });
});
