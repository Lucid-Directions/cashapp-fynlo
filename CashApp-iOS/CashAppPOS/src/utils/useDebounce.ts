import { useEffect, useState } from 'react';

/**
 * useDebounce – returns a debounced (delayed) version of the given value.
 * It is generic and can be reused for strings, numbers, objects, etc.
 *
 * @param value    Raw input value that changes often.
 * @param delayMs  Wait time in milliseconds (default 300 ms).
 */
export function useDebounce<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
