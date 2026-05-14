import type { Converter } from '../types.js';

export function createConverter(
  fromProtocol: string,
  toProtocol: string,
  impl: Omit<Converter, 'fromProtocol' | 'toProtocol'>,
): Converter {
  return { fromProtocol, toProtocol, ...impl };
}
