// env.ts – centralised environment helpers for runtime & tests
// -----------------------------------------------------------------------------
// 1. Guarantees a single import site for React-Native globals such as __DEV__.
// 2. Normalises boolean env flags ("1", "true", "0", "false").
// 3. Provides a tiny helper so feature-flag objects can read from the env first
//    and still fall back to a compile-time default.
// -----------------------------------------------------------------------------

export const IS_DEV: boolean = typeof __DEV__ !== 'undefined' ? __DEV__ : false;

/**
 * Read a boolean value from process.env.<NAME>.
 * Recognises: "1" | "true" (⇢ true)  and  "0" | "false" (⇢ false).
 * If the variable is undefined or unparsable the provided fallback is returned.
 */
export function envBool(name: string, fallback: boolean = false): boolean {
  const raw = (process.env[name] ?? '').toString().toLowerCase();
  if (raw === '1' || raw === 'true') return true;
  if (raw === '0' || raw === 'false') return false;
  return fallback;
}
