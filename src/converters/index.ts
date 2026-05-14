import { ConverterRegistry } from './registry.js';
import { OpenAIChatToResponsesConverter, ResponsesToOpenAIChatConverter } from './openai-responses.js';
import { AnthropicToOpenAIChatConverter, OpenAIChatToAnthropicConverter } from './anthropic-openai.js';

export function registerAllConverters(): void {
  ConverterRegistry.register(new OpenAIChatToResponsesConverter());
  ConverterRegistry.register(new ResponsesToOpenAIChatConverter());
  ConverterRegistry.register(AnthropicToOpenAIChatConverter);
  ConverterRegistry.register(OpenAIChatToAnthropicConverter);
}

export { ConverterRegistry } from './registry.js';
