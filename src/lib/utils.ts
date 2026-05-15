export function deepMerge<T extends Record<string, unknown>>(base: T, overlay: Record<string, unknown>): T {
  const result = { ...base };
  for (const [key, val] of Object.entries(overlay)) {
    if (val !== undefined) {
      if (typeof val === 'object' && !Array.isArray(val) && typeof result[key] === 'object' && !Array.isArray(result[key])) {
        (result as Record<string, unknown>)[key] = deepMerge(
          (result as Record<string, unknown>)[key] as Record<string, unknown>,
          val as Record<string, unknown>,
        );
      } else {
        (result as Record<string, unknown>)[key] = val;
      }
    }
  }
  return result;
}
