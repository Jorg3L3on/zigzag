import { type ClassValue, clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * tailwind-merge only knows Tailwind's own sizes, so it read our `text-caption`
 * (globals.css @theme, ZIG-I18-5) as a text color: `cn('text-caption',
 * 'text-muted-foreground')` dropped one of the two (ZIG-26). Registering it as
 * a font size keeps both; two sizes or two colors still merge as before.
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ['caption'],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type JsonValue = string | number | boolean | null | JsonObject | JsonArray;
type JsonObject = { [key: string]: JsonValue };
type JsonArray = JsonValue[];

// Helper function to convert BigInt to string in the response
export function convertBigIntToString(obj: unknown): JsonValue {
  if (obj === null) {
    return null;
  }

  if (obj === undefined) {
    return null;
  }

  if (obj instanceof Date) {
    return obj.toISOString();
  }

  if (typeof obj === 'bigint') {
    return obj.toString();
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => convertBigIntToString(item));
  }

  if (typeof obj === 'object') {
    const converted: JsonObject = {};
    for (const [key, value] of Object.entries(obj as JsonObject)) {
      const convertedValue = convertBigIntToString(value);
      if (convertedValue !== undefined) {
        converted[key] = convertedValue;
      }
    }
    return converted;
  }

  return obj as JsonValue;
}
