const CHUNK_LOAD_PATTERNS = [
  /loading chunk [\d]+ failed/i,
  /chunkloaderror/i,
  /failed to fetch dynamically imported module/i,
  /importing a module script failed/i,
  /error loading dynamically imported module/i,
];

/** Detect stale PWA / post-deploy JS chunk failures (common on mobile). */
export const isChunkLoadError = (error: unknown): boolean => {
  if (!(error instanceof Error)) {
    return false;
  }

  const haystack = `${error.name} ${error.message}`;
  return CHUNK_LOAD_PATTERNS.some((pattern) => pattern.test(haystack));
};

export const CHUNK_RELOAD_SESSION_KEY = 'zigzag:chunk-reload-attempted';
