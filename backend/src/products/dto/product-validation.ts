export function trimString({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

// Money crosses the API boundary as decimal text, never a binary float.
export const MONEY_PATTERN = /^(0|[1-9]\d{0,9})(\.\d{1,2})?$/;
export const MAX_QUANTITY = 2147483647;
