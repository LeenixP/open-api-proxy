export function v0ToV1(config: Record<string, unknown>): Record<string, unknown> {
  const result = { ...config };
  result._schema_version = 1;
  result.providers = result.providers || {};
  return result;
}
