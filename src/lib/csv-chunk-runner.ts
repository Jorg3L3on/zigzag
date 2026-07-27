export const SERVICE_CSV_COMMIT_CHUNK_SIZE = 50;

export type ChunkRunnerProgress = {
  completedChunks: number;
  totalChunks: number;
  processedItems: number;
  totalItems: number;
};

export type ChunkRunnerResult<TResult> = {
  stopped: boolean;
  chunkResults: TResult[];
  completedChunks: number;
  totalChunks: number;
  error?: string;
};

/**
 * Run `runChunk` over successive slices of `items`. Stops immediately when a
 * chunk returns `{ ok: false }` or throws — no automatic retry.
 */
export const runChunkedImport = async <TItem, TResult>(options: {
  items: TItem[];
  chunkSize?: number;
  runChunk: (
    chunk: TItem[],
    chunkIndex: number,
  ) => Promise<{ ok: true; result: TResult } | { ok: false; error: string }>;
  onProgress?: (progress: ChunkRunnerProgress) => void;
}): Promise<ChunkRunnerResult<TResult>> => {
  const chunkSize = Math.max(1, options.chunkSize ?? SERVICE_CSV_COMMIT_CHUNK_SIZE);
  const totalItems = options.items.length;
  const totalChunks = totalItems === 0 ? 0 : Math.ceil(totalItems / chunkSize);
  const chunkResults: TResult[] = [];

  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex += 1) {
    const start = chunkIndex * chunkSize;
    const chunk = options.items.slice(start, start + chunkSize);

    try {
      const outcome = await options.runChunk(chunk, chunkIndex);
      if (!outcome.ok) {
        return {
          stopped: true,
          chunkResults,
          completedChunks: chunkIndex,
          totalChunks,
          error: outcome.error,
        };
      }
      chunkResults.push(outcome.result);
    } catch (error) {
      return {
        stopped: true,
        chunkResults,
        completedChunks: chunkIndex,
        totalChunks,
        error: error instanceof Error ? error.message : 'Error al importar el bloque',
      };
    }

    options.onProgress?.({
      completedChunks: chunkIndex + 1,
      totalChunks,
      processedItems: Math.min(start + chunk.length, totalItems),
      totalItems,
    });
  }

  return {
    stopped: false,
    chunkResults,
    completedChunks: totalChunks,
    totalChunks,
  };
};
