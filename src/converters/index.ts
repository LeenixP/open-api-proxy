import { ConverterRegistry } from './registry.js';
import { OpenAIChatToResponsesConverter, ResponsesToOpenAIChatConverter } from './openai-responses.js';
import { AnthropicToOpenAIChatConverter, OpenAIChatToAnthropicConverter } from './anthropic-openai.js';
import { anthropicToResponses, responsesToAnthropic } from './anthropic-responses.js';

export function registerAllConverters(): void {
  ConverterRegistry.register(new OpenAIChatToResponsesConverter());
  ConverterRegistry.register(new ResponsesToOpenAIChatConverter());
  ConverterRegistry.register(AnthropicToOpenAIChatConverter);
  ConverterRegistry.register(OpenAIChatToAnthropicConverter);
  ConverterRegistry.register(anthropicToResponses);
  ConverterRegistry.register(responsesToAnthropic);
}

export { ConverterRegistry } from './registry.js';
