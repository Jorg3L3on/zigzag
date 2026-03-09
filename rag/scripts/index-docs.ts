#!/usr/bin/env ts-node
/**
 * rag:index — chunks all markdown files in rag/docs/ and writes
 * a TF-IDF vector index to rag/index/vectors.json.
 *
 * Run:  npm run rag:index
 */

import * as path from 'path';
import { loadDocuments } from '../src/chunker';
import { buildIndex } from '../src/embedder';
import { saveIndex } from '../src/vector-store';

const DOCS_DIR = path.join(__dirname, '..', 'docs');
const INDEX_PATH = path.join(__dirname, '..', 'index', 'vectors.json');

async function main() {
  console.log('\n📚 RAG Indexer\n');

  console.log(`Loading docs from: ${DOCS_DIR}`);
  const chunks = loadDocuments(DOCS_DIR);

  if (chunks.length === 0) {
    console.error('No chunks found. Add .md files to rag/docs/');
    process.exit(1);
  }

  console.log('Building TF-IDF index...');
  const index = buildIndex(chunks);

  // Stamp each chunk with the build timestamp so search filters can use it.
  for (const chunk of index.chunks) chunk.indexedAt = index.createdAt;

  saveIndex(index, INDEX_PATH);
  console.log(`\n✅ Done! Indexed ${index.totalDocs} chunks from ${DOCS_DIR}`);
  console.log(`   Vocabulary size: ${index.vocabulary.length} tokens`);
  console.log(`   Index created:   ${index.createdAt}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
