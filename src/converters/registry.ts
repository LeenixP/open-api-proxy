import type { Converter } from '../types.js';

type ConverterFactory = () => Converter;

export class ConverterRegistry {
  private static factories: Map<string, ConverterFactory> = new Map();

  private static key(from: string, to: string): string {
    return `${from}->${to}`;
  }

  static register(factoryOrConverter: ConverterFactory | Converter): void {
    const factory = typeof factoryOrConverter === 'function'
      ? factoryOrConverter as ConverterFactory
      : () => factoryOrConverter as Converter;
    // Extract proto info from a temporary instance to build the key
    const instance = factory();
    this.factories.set(this.key(instance.fromProtocol, instance.toProtocol), factory);
  }

  static get(fromProtocol: string, toProtocol: string): Converter | null {
    const factory = this.factories.get(this.key(fromProtocol, toProtocol));
    return factory ? factory() : null;
  }

  static needsConversion(fromProtocol: string, toProtocol: string): boolean {
    if (fromProtocol === toProtocol) return false;
    return this.factories.has(this.key(fromProtocol, toProtocol));
  }

  static directions(): string[] {
    return Array.from(this.factories.keys());
  }

  static clear(): void {
    this.factories.clear();
  }
}
