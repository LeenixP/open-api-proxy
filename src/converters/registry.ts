import type { Converter } from '../types.js';

export class ConverterRegistry {
  private static converters: Map<string, Converter> = new Map();

  private static key(from: string, to: string): string {
    return `${from}->${to}`;
  }

  static register(converter: Converter): void {
    this.converters.set(this.key(converter.fromProtocol, converter.toProtocol), converter);
  }

  static get(fromProtocol: string, toProtocol: string): Converter | null {
    return this.converters.get(this.key(fromProtocol, toProtocol)) || null;
  }

  static needsConversion(fromProtocol: string, toProtocol: string): boolean {
    if (fromProtocol === toProtocol) return false;
    return this.converters.has(this.key(fromProtocol, toProtocol));
  }

  static directions(): string[] {
    return Array.from(this.converters.keys());
  }

  static clear(): void {
    this.converters.clear();
  }
}
