import { useState, useCallback, useRef, useEffect } from 'react';
import type { ZodType } from 'zod';
import { validateField } from '../utils/validationSchemas';

/**
 * Custom hook for validated form inputs.
 * 
 * Usage:
 * ```ts
 * const v = useValidatedInput(instancesSchema, node.data.instances, (val) => update('instances', val));
 * <input value={v.displayValue} onChange={v.onChange} />
 * {v.error && <span className="form-error">{v.error}</span>}
 * ```
 */
export function useValidatedInput<T>(
  schema: ZodType<T>,
  value: T,
  onCommit: (value: T) => void,
) {
  const [error, setError] = useState<string | null>(null);
  const [displayValue, setDisplayValue] = useState<string>(String(value));
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync display value when external value changes
  useEffect(() => {
    setDisplayValue(String(value));
  }, [value]);

  const onChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      setDisplayValue(raw);

      // Clear previous debounce
      if (timerRef.current) clearTimeout(timerRef.current);

      timerRef.current = setTimeout(() => {
        // Try to coerce to number if the schema expects it
        const parsed = raw === '' ? raw : isNaN(Number(raw)) ? raw : Number(raw);
        const errMsg = validateField(schema, parsed);

        if (errMsg) {
          setError(errMsg);
        } else {
          setError(null);
          onCommit(parsed as T);
        }
      }, 300);
    },
    [schema, onCommit],
  );

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { displayValue, error, onChange };
}

/**
 * Instant validation (no debounce) for slider/select inputs.
 */
export function useValidatedRange<T>(
  schema: ZodType<T>,
  value: T,
  onCommit: (value: T) => void,
) {
  const [error, setError] = useState<string | null>(null);

  const onChange = useCallback(
    (newValue: T) => {
      const errMsg = validateField(schema, newValue);
      if (errMsg) {
        setError(errMsg);
      } else {
        setError(null);
        onCommit(newValue);
      }
    },
    [schema, onCommit],
  );

  return { value, error, onChange };
}
