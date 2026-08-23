import {
  CHUNK_RELOAD_SESSION_KEY,
  isChunkLoadError,
} from '@/lib/chunk-load-error';

describe('isChunkLoadError', () => {
  it('detects common chunk load failures', () => {
    expect(
      isChunkLoadError(new Error('Loading chunk 123 failed.')),
    ).toBe(true);
    expect(
      isChunkLoadError(new Error('Failed to fetch dynamically imported module')),
    ).toBe(true);
    const chunkError = new Error('missing');
    chunkError.name = 'ChunkLoadError';
    expect(isChunkLoadError(chunkError)).toBe(true);
  });

  it('ignores unrelated errors', () => {
    expect(isChunkLoadError(new Error('database exploded'))).toBe(false);
    expect(isChunkLoadError('nope')).toBe(false);
  });

  it('exports a stable reload session key', () => {
    expect(CHUNK_RELOAD_SESSION_KEY).toBe('zigzag:chunk-reload-attempted');
  });
});
