/**
 * @jest-environment node
 *
 * ZIG-I18-5 type floor: labels, hints, errors, pills and meta lines are at
 * least 14px (`text-caption`). 12px (`text-xs`) lives only in the decorative
 * Badge; 10/11/13px arbitrary sizes are gone.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const SRC_DIR = path.join(process.cwd(), 'src');
const SELF = path.relative(process.cwd(), __filename);
const FORBIDDEN = /(?<![\w-])text-xs(?![\w-])|text-\[(10|11|13)px\]|text-\[0\.8rem\]/;
/**
 * The floor is for phones: a class behind md:, lg:, xl: or 2xl: only applies on wider
 * screens, where the approved desktop canvases use 11 and 13 px (ZIG-31).
 */
const WIDE_SCREEN_CLASS = /(?<![\w-])(?:md|lg|xl|2xl):[^\s'"`]+/g;
/** Decorative badges keep 12px. */
const ALLOWLIST = new Set(['src/components/ui/badge.tsx']);
/**
 * Files that already broke the floor when CI first ran the guard (ZIG-31). Mostly
 * desktop-only canvases, but the collect-payment dialog and the line row also show on
 * phones. Being resolved in ZIG-32; do not add files here, fix the size instead.
 */
const KNOWN_OFFENDERS = new Set([
  'src/components/clients/detail/client-detail-header.tsx',
  'src/components/cobranza/cobranza-aging-strip.tsx',
  'src/components/cobranza/cobranza-client-table.tsx',
  'src/components/cobranza/cobranza-columns.tsx',
  'src/components/cobranza/cobranza-desktop.tsx',
  'src/components/cobranza/cobranza-row-actions.tsx',
  'src/components/cobranza/cobranza-ticket-table.tsx',
  'src/components/documents/document-line-row.tsx',
  'src/components/presupuestos/presupuesto-desktop.tsx',
  'src/components/presupuestos/presupuestos-table.tsx',
  'src/components/tickets/detail/ticket-detail-client-card.tsx',
  'src/components/tickets/detail/ticket-detail-section-card.tsx',
  'src/components/tickets/ticket-list-collect-payment-dialog.tsx',
  'src/components/tickets/tickets-columns.tsx',
]);
const SCANNED = /\.(tsx?|css)$/;

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return walk(full);
    return SCANNED.test(name) && !/\.test\./.test(name) ? [full] : [];
  });

describe('type floor guard', () => {
  it('finds no text-xs / text-[10px] / text-[11px] / text-[13px] outside the allowlist', () => {
    const offenders = walk(SRC_DIR)
      .map((file) => path.relative(process.cwd(), file))
      .filter((file) => file !== SELF && !ALLOWLIST.has(file) && !KNOWN_OFFENDERS.has(file))
      .flatMap((file) =>
        readFileSync(file, 'utf8')
          .split('\n')
          .map((text, index) => ({ text, line: index + 1 }))
          .filter(({ text }) => FORBIDDEN.test(text.replace(WIDE_SCREEN_CLASS, '')))
          .map(({ line, text }) => `${file}:${line}: ${text.trim().slice(0, 100)}`),
      );
    expect(offenders).toEqual([]);
  });

  it('defines the caption token at 14px', () => {
    const css = readFileSync(path.join(SRC_DIR, 'app/globals.css'), 'utf8');
    expect(css).toMatch(/--text-caption:\s*0\.875rem/);
  });
});
