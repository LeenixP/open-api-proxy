import { ConverterRegistry } from './registry.js';
import { OpenAIChatToResponsesConverter, ResponsesToOpenAIChatConverter } from './openai-responses.js';
import { AnthropicToOpenAIChatConverter, OpenAIChatToAnthropicConverter } from './anthropic-openai.js';
import { AnthropicToResponsesConverter, ResponsesToAnthropicConverter } from './anthropic-responses.js';

export function registerAllConverters(): void {
  ConverterRegistry.register(() => new OpenAIChatToResponsesConverter());
  ConverterRegistry.register(() => new ResponsesToOpenAIChatConverter());
  ConverterRegistry.register(AnthropicToOpenAIChatConverter);
  ConverterRegistry.register(OpenAIChatToAnthropicConverter);
  ConverterRegistry.register(() => new AnthropicToResponsesConverter());
  ConverterRegistry.register(() => new ResponsesToAnthropicConverter());
}

export { ConverterRegistry } from './registry.js';
