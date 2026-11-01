#!/usr/bin/env node
/**
 * Fail when docs/idor-audit-matrix.md has uncovered protected surfaces (⬜), or
 * when an exported 'use server' action under src/actions has no matrix row
 * (its name must appear in a table row; ZIG-I36-14).
 * Exempt rows (⏭️) and partial (🟡) are allowed; CI gate expects all ✅ or ⏭️.
 */
import { readFileSync, readdirSync } from 'node:fs';
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

const matrixRows = content
  .split('\n')
  .filter((line) => line.startsWith('|') && !line.includes('---'));

const EXPORTED_ACTION =
  /^export\s+(?:async\s+function\s+(\w+)|const\s+(\w+)\s*=\s*async\b)/gm;

const unlisted = [];
const actionsDir = join(root, 'src/actions');
for (const file of readdirSync(actionsDir).sort()) {
  if (!file.endsWith('.ts') || /\.test\.ts$/.test(file)) continue;
  const source = readFileSync(join(actionsDir, file), 'utf8');
  if (!/^['"]use server['"]/m.test(source)) continue;
  for (const match of source.matchAll(EXPORTED_ACTION)) {
    const name = match[1] ?? match[2];
    const word = new RegExp(`(^|[^\\w])${name}([^\\w]|$)`);
    if (!matrixRows.some((row) => word.test(row))) {
      unlisted.push(`src/actions/${file}: ${name}`);
    }
  }
}

if (uncovered.length > 0) {
  console.error('IDOR audit matrix has uncovered protected surfaces:\n');
  for (const row of uncovered) {
    console.error(`  ${row}`);
  }
}

if (unlisted.length > 0) {
  console.error(
    "Exported server actions with no row in docs/idor-audit-matrix.md:\n",
  );
  for (const entry of unlisted) {
    console.error(`  ${entry}`);
  }
}

if (uncovered.length > 0 || unlisted.length > 0) {
  process.exit(1);
}

console.log('IDOR audit matrix: all protected surfaces covered or exempt.');
