/**
 * TF-IDF embedder — no external dependencies, works fully offline.
 *
 * Each document chunk is represented as a sparse vector over a shared
 * vocabulary weighted by term frequency × inverse document frequency.
 * Similarity is measured with cosine distance.
 *
 * This is intentionally simple ("mini RAG"). For better semantic recall
 * you can swap `buildIndex` / `embedQuery` for an OpenAI or Cohere
 * embeddings call while keeping the rest of the pipeline unchanged.
 */

import { Chunk, IndexedChunk, VectorIndex } from './types';

// ── Tokenisation ─────────────────────────────────────────────────────────────

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9_\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2 && t !== 'constructor');
}

// ── TF / IDF ─────────────────────────────────────────────────────────────────

// Use Object.create(null) to avoid prototype-chain pollution
// (words like "constructor" or "toString" live on Object.prototype)

function computeTF(tokens: string[]): Record<string, number> {
  const tf: Record<string, number> = Object.create(null);
  for (const t of tokens) tf[t] = (tf[t] || 0) + 1;
  const total = tokens.length || 1;
  for (const t in tf) tf[t] /= total;
  return tf;
}

function computeIDF(tokenizedDocs: string[][]): Record<string, number> {
  const N = tokenizedDocs.length;
  const df: Record<string, number> = Object.create(null);
  for (const doc of tokenizedDocs) {
    for (const t of new Set(doc)) df[t] = (df[t] || 0) + 1;
  }
  const idf: Record<string, number> = Object.create(null);
  for (const t in df) idf[t] = Math.log(N / df[t]) + 1;
  return idf;
}

function buildVocabulary(tokenizedDocs: string[][]): string[] {
  const vocab = new Set<string>();
  for (const doc of tokenizedDocs) for (const t of doc) vocab.add(t);
  return Array.from(vocab).sort();
}

// ── Vector helpers ────────────────────────────────────────────────────────────

function toVector(
  tokens: string[],
  idf: Record<string, number>,
  vocabulary: string[]
): number[] {
  const tf = computeTF(tokens);
  return vocabulary.map((w) => (tf[w] || 0) * (idf[w] || 0));
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0,
    na = 0,
    nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

// ── Public API ────────────────────────────────────────────────────────────────

export function buildIndex(chunks: Chunk[]): VectorIndex {
  const tokenized = chunks.map((c) => tokenize(c.content));
  const idf = computeIDF(tokenized);
  const vocabulary = buildVocabulary(tokenized);

  const indexed: IndexedChunk[] = chunks.map((chunk, i) => ({
    ...chunk,
    embedding: toVector(tokenized[i], idf, vocabulary),
  }));

  return {
    chunks: indexed,
    vocabulary,
    idf,
    createdAt: new Date().toISOString(),
    totalDocs: chunks.length,
  };
}

export function embedQuery(query: string, index: VectorIndex): number[] {
  const tokens = tokenize(query);
  return toVector(tokens, index.idf, index.vocabulary);
}
