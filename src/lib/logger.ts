/**
 * Lightweight structured (JSON) logger. Isomorphic and dependency-free so it is
 * safe to import from anywhere. Pairs with `correlationId()` to thread a request
 * id through logs for a single operation.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type LogMeta = Record<string, unknown>;

/** Generate a correlation/request id for tracing a single operation. */
export const correlationId = (): string => {
  try {
    return crypto.randomUUID();
  } catch {
    return `req_${Date.now().toString(36)}_${Math.random()
      .toString(36)
      .slice(2, 10)}`;
  }
};

const serialize = (value: unknown): unknown => {
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }
  if (typeof value === 'bigint') {
    return value.toString();
  }
  return value;
};

const emit = (level: LogLevel, message: string, meta?: LogMeta): void => {
  const entry: Record<string, unknown> = {
    level,
    message,
    time: new Date().toISOString(),
  };
  if (meta) {
    for (const [key, value] of Object.entries(meta)) {
      entry[key] = serialize(value);
    }
  }

  let line: string;
  try {
    line = JSON.stringify(entry);
  } catch {
    line = JSON.stringify({ level, message, time: entry.time });
  }

  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }
};

export const logger = {
  debug: (message: string, meta?: LogMeta) => emit('debug', message, meta),
  info: (message: string, meta?: LogMeta) => emit('info', message, meta),
  warn: (message: string, meta?: LogMeta) => emit('warn', message, meta),
  error: (message: string, meta?: LogMeta) => emit('error', message, meta),
};
