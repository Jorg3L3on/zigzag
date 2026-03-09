export interface Chunk {
  id: string;
  content: string;
  source: string;    // relative path inside rag/docs/
  heading: string;   // nearest markdown heading
  indexedAt?: string; // ISO timestamp of the index build that produced this chunk
}

export interface IndexedChunk extends Chunk {
  embedding: number[];
}

export interface SearchFilters {
  source?: string; // keep only chunks whose source matches this string exactly
  after?: string;  // keep only chunks where indexedAt > this ISO date string
}

export interface VectorIndex {
  chunks: IndexedChunk[];
  vocabulary: string[];
  idf: Record<string, number>;
  createdAt: string;
  totalDocs: number;
}

export interface SearchResult {
  chunk: Chunk;
  score: number;
}
