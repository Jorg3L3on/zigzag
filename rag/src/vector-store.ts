import * as fs from 'fs';
import * as path from 'path';
import { VectorIndex, SearchResult, SearchFilters } from './types';
import { cosineSimilarity, embedQuery } from './embedder';

export function saveIndex(index: VectorIndex, indexPath: string): void {
  const dir = path.dirname(indexPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(indexPath, JSON.stringify(index), 'utf-8');
  const kb = Math.round(fs.statSync(indexPath).size / 1024);
  console.log(`  Saved ${index.chunks.length} chunks → ${indexPath} (${kb} KB)`);
}

export function loadIndex(indexPath: string): VectorIndex {
  if (!fs.existsSync(indexPath)) {
    throw new Error(
      `Index not found at "${indexPath}".\nRun:  npm run rag:index`
    );
  }
  return JSON.parse(fs.readFileSync(indexPath, 'utf-8')) as VectorIndex;
}

export function search(
  query: string,
  index: VectorIndex,
  topK = 5,
  filters: SearchFilters = {}
): SearchResult[] {
  const qv = embedQuery(query, index);

  // Apply metadata filters before scoring to reduce the candidate set.
  const candidates = index.chunks.filter((chunk) => {
    if (filters.source && chunk.source !== filters.source) return false;
    if (filters.after && (chunk.indexedAt ?? '') <= filters.after) return false;
    return true;
  });

  return candidates
    .map((chunk) => ({
      chunk: {
        id: chunk.id,
        content: chunk.content,
        source: chunk.source,
        heading: chunk.heading,
        indexedAt: chunk.indexedAt,
      },
      score: cosineSimilarity(qv, chunk.embedding),
    }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

export function formatContext(results: SearchResult[]): string {
  if (results.length === 0) return 'No relevant documentation found.';

  return results
    .map((r, i) => {
      const date = r.chunk.indexedAt
        ? r.chunk.indexedAt.slice(0, 10) // YYYY-MM-DD
        : 'unknown';
      return (
        `### [${i + 1}] ${r.chunk.source} — ${r.chunk.heading}\n\n` +
        `Indexed: ${date}\nScore: ${r.score.toFixed(3)}\n\n` +
        r.chunk.content
      );
    })
    .join('\n\n---\n\n');
}
