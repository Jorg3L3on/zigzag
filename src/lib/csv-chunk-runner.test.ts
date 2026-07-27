import {
  runChunkedImport,
  SERVICE_CSV_COMMIT_CHUNK_SIZE,
} from '@/lib/csv-chunk-runner';

describe('runChunkedImport', () => {
  it('uses chunk size 50 by default', async () => {
    const items = Array.from({ length: 120 }, (_, i) => i);
    const sizes: number[] = [];
    const result = await runChunkedImport({
      items,
      runChunk: async (chunk) => {
        sizes.push(chunk.length);
        return { ok: true as const, result: chunk.length };
      },
    });
    expect(SERVICE_CSV_COMMIT_CHUNK_SIZE).toBe(50);
    expect(sizes).toEqual([50, 50, 20]);
    expect(result.stopped).toBe(false);
    expect(result.completedChunks).toBe(3);
  });

  it('reports progress after each successful chunk', async () => {
    const progress: Array<{ completedChunks: number; processedItems: number }> =
      [];
    await runChunkedImport({
      items: [1, 2, 3, 4],
      chunkSize: 2,
      runChunk: async () => ({ ok: true as const, result: true }),
      onProgress: (p) =>
        progress.push({
          completedChunks: p.completedChunks,
          processedItems: p.processedItems,
        }),
    });
    expect(progress).toEqual([
      { completedChunks: 1, processedItems: 2 },
      { completedChunks: 2, processedItems: 4 },
    ]);
  });

  it('stops on first chunk failure without retry', async () => {
    let calls = 0;
    const result = await runChunkedImport({
      items: [1, 2, 3, 4],
      chunkSize: 2,
      runChunk: async () => {
        calls += 1;
        if (calls === 1) {
          return { ok: false as const, error: 'boom' };
        }
        return { ok: true as const, result: true };
      },
    });
    expect(calls).toBe(1);
    expect(result.stopped).toBe(true);
    expect(result.error).toBe('boom');
    expect(result.completedChunks).toBe(0);
    expect(result.chunkResults).toEqual([]);
  });

  it('keeps prior chunk results when a later chunk fails', async () => {
    let calls = 0;
    const result = await runChunkedImport({
      items: [1, 2, 3, 4],
      chunkSize: 2,
      runChunk: async () => {
        calls += 1;
        if (calls === 2) {
          return { ok: false as const, error: 'second failed' };
        }
        return { ok: true as const, result: { inserted: 2 } };
      },
    });
    expect(result.stopped).toBe(true);
    expect(result.chunkResults).toEqual([{ inserted: 2 }]);
    expect(result.completedChunks).toBe(1);
  });
});
