import { ConverterRegistry } from './registry.js';
import { OpenAIChatToResponsesConverter, ResponsesToOpenAIChatConverter } from './openai-responses.js';

export function registerAllConverters(): void {
  ConverterRegistry.register(new OpenAIChatToResponsesConverter());
  ConverterRegistry.register(new ResponsesToOpenAIChatConverter());
}

export { ConverterRegistry } from './registry.js';
