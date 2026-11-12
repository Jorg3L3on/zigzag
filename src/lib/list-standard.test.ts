/**
 * @jest-environment node
 *
 * ZIG-I33-9 list standard gates (docs/listas-escritorio.md, standard §12): the desktop
 * lists share one table recipe, one row menu, one sortable header, one short date and
 * one viewport hook, so no page grows its own copy again.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const SRC_DIR = path.join(process.cwd(), 'src');
const SCANNED = /\.tsx?$/;

/** The list pages' components (ZIG-I33 §0); list-page/ holds the shared pieces. */
const LIST_COMPONENT_DIRS = [
  'tickets',
  'presupuestos',
  'cobranza',
  'clients',
  'services',
  'service-schedules',
  'companies',
  'roles',
  'users',
  'permissions',
  'audit',
  'operator-console',
].map((dir) => `src/components/${dir}/`);

type Gate = {
  name: string;
  pattern: RegExp;
  /** Which files the gate reads. */
  applies: (file: string) => boolean;
  /** Files where a match is legitimate, each with its reason. Keep it short. */
  allow: Record<string, string>;
};

const GATES: Gate[] = [
  {
    name: 'table cell styles ([&_th]: / [&_td]:) live in LIST_TABLE_CLASS',
    pattern: /\[&_t[hd]\]:/,
    applies: (file) => file !== 'src/components/ui/table.tsx',
    allow: {},
  },
  {
    name: 'no vertical ⋮ in list components: desktop rows use ListRowMenu, phone cards ListCardMenu',
    pattern: /\bMoreVertical\b/,
    applies: (file) => LIST_COMPONENT_DIRS.some((dir) => file.startsWith(dir)),
    allow: {},
  },
  {
    name: 'no local sortable header: use ListSortableHeader',
    pattern: /\b(?:const|function|class)\s+(?!ListSortableHeader\b)\w*SortableHeader\b/,
    applies: (file) => !file.startsWith('src/components/list-page/'),
    allow: {},
  },
  {
    name: 'no local shortDate: use ListShortDate or formatListShortDate',
    pattern: /\b(?:const|function)\s+shortDate\b/,
    applies: () => true,
    allow: {},
  },
  {
    name: 'one useDesktopViewport, in hooks/use-desktop.ts',
    pattern: /\b(?:const|function)\s+useDesktopViewport\b/,
    applies: (file) => file !== 'src/hooks/use-desktop.ts',
    allow: {},
  },
];

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return walk(full);
    return SCANNED.test(name) && !/\.test\./.test(name) ? [full] : [];
  });

const files = walk(SRC_DIR).map((file) => ({
  file: path.relative(process.cwd(), file).split(path.sep).join('/'),
  full: file,
}));

describe('list standard gates (ZIG-I33-9)', () => {
  it.each(GATES.map((gate) => [gate.name, gate] as const))('%s', (_, gate) => {
    const offenders = files
      .filter(({ file }) => gate.applies(file) && !(file in gate.allow))
      .flatMap(({ file, full }) =>
        readFileSync(full, 'utf8')
          .split('\n')
          .map((text, index) => ({ text, line: index + 1 }))
          .filter(({ text }) => gate.pattern.test(text))
          .map(({ line, text }) => `${file}:${line}: ${text.trim().slice(0, 100)}`),
      );
    expect(offenders).toEqual([]);
  });

  it('keeps every allowlisted file real', () => {
    const known = new Set(files.map(({ file }) => file));
    const stale = GATES.flatMap((gate) => Object.keys(gate.allow)).filter((file) => !known.has(file));
    expect(stale).toEqual([]);
  });
});
