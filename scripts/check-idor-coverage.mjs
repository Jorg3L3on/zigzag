#!/usr/bin/env node
/**
 * Fail when docs/idor-audit-matrix.md has uncovered protected surfaces (⬜).
 * Exempt rows (⏭️) and partial (🟡) are allowed; CI gate expects all ✅ or ⏭️.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const matrixPath = join(root, 'docs/idor-audit-matrix.md');
const content = readFileSync(matrixPath, 'utf8');

const uncovered = [];
for (const line of content.split('\n')) {
  if (!line.startsWith('|') || line.includes('---')) continue;
  if (!line.includes('⬜')) continue;
  if (line.includes('Status')) continue;
  uncovered.push(line.trim());
}

if (uncovered.length > 0) {
  console.error('IDOR audit matrix has uncovered protected surfaces:\n');
  for (const row of uncovered) {
    console.error(`  ${row}`);
  }
  process.exit(1);
}

console.log('IDOR audit matrix: all protected surfaces covered or exempt.');
