import type { Converter } from '../types.js';

type ConverterFactory = () => Converter;

export class ConverterRegistry {
  private static factories: Map<string, ConverterFactory> = new Map();
  private static instances: Map<string, Converter> = new Map();

  private static key(from: string, to: string): string {
    return `${from}->${to}`;
  }

  static register(factoryOrConverter: ConverterFactory | Converter): void {
    const factory = typeof factoryOrConverter === 'function'
      ? factoryOrConverter as ConverterFactory
      : () => factoryOrConverter as Converter;
    // Extract proto info from a temporary instance to build the key
    const instance = factory();
    const k = this.key(instance.fromProtocol, instance.toProtocol);
    this.factories.set(k, factory);
    // Cache the instance created during registration
    this.instances.set(k, instance);
  }

  static get(fromProtocol: string, toProtocol: string): Converter | null {
    const k = this.key(fromProtocol, toProtocol);
    const cached = this.instances.get(k);
    if (cached) return cached;
    const factory = this.factories.get(k);
    if (!factory) return null;
    const instance = factory();
    this.instances.set(k, instance);
    return instance;
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
    this.instances.clear();
  }
}
