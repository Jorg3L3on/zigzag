#!/usr/bin/env ts-node
/**
 * rag:search — performs a similarity search against the index and prints
 * the top-k matching chunks to stdout (no LLM call).
 *
 * Run:  npm run rag:search "how does multi-tenancy work?"
 */

import * as path from 'path';
import { loadIndex, search, formatContext } from '../src/vector-store';
import { SearchFilters } from '../src/types';

const INDEX_PATH = path.join(__dirname, '..', 'index', 'vectors.json');
const TOP_K = 5;

// Split argv into positional query words and --key=value flags.
// npm 7+ intercepts --flag=value before the child process sees them and
// injects them as npm_config_<flag> env vars instead, so we check both.
function parseArgs(argv: string[]): { query: string; filters: SearchFilters } {
  const filters: SearchFilters = {};
  const queryParts: string[] = [];
  for (const arg of argv) {
    const m = arg.match(/^--([a-zA-Z]+)=(.+)$/);
    if (m) {
      if (m[1] === 'source') filters.source = m[2];
      if (m[1] === 'after') filters.after = m[2];
    } else {
      queryParts.push(arg);
    }
  }
  // Fallback: npm 7+ passes --key=value as npm_config_key env vars
  if (!filters.source && process.env.npm_config_source) filters.source = process.env.npm_config_source;
  if (!filters.after && process.env.npm_config_after) filters.after = process.env.npm_config_after;
  return { query: queryParts.join(' ').trim(), filters };
}

async function main() {
  const { query, filters } = parseArgs(process.argv.slice(2));
  if (!query) {
    console.error(
      'Usage: npm run rag:search "<question>" [--source=<file>] [--after=<ISO date>]'
    );
    process.exit(1);
  }

  const index = loadIndex(INDEX_PATH);
  const results = search(query, index, TOP_K, filters);

  console.log(`\n🔍 Query: "${query}"\n`);
  if (filters.source) console.log(`   Filter source: ${filters.source}`);
  if (filters.after) console.log(`   Filter after:  ${filters.after}`);
  console.log('='.repeat(70));
  console.log(formatContext(results));
  console.log('='.repeat(70));
  console.log(`\nFound ${results.length} relevant chunks.\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
