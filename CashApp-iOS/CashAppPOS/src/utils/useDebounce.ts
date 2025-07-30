import { useEffect, useState } from 'react';

/**
 * useDebounce – returns a debounced (_delayed) version of the given value.
 * It is generic and can be reused for strings, numbers, objects, etc.
 *
 * @param value    Raw input value that changes often.
 * @param delayMs  Wait time in milliseconds (default 300 ms).
 */
export function useDebounce<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState<T>(_value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(_value), delayMs);
    return () => clearTimeout(_timer);
  }, [value, delayMs]);

  return debounced;
}
