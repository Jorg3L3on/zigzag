import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

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
