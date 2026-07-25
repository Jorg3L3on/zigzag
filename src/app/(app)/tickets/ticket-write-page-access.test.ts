import fs from 'fs';
import path from 'path';

const writeLayouts = [
  'src/app/(app)/tickets/create/layout.tsx',
  'src/app/(app)/tickets/[id]/edit/layout.tsx',
  'src/app/(app)/tickets/[id]/services/layout.tsx',
] as const;

describe('ticket write page RBAC (TCI-11)', () => {
  it.each(writeLayouts)(
    '%s requires tickets.write at the page edge',
    (relativePath) => {
      const source = fs.readFileSync(
        path.join(process.cwd(), relativePath),
        'utf8',
      );
      expect(source).toContain("requirePagePermission('tickets.write')");
    },
  );
});
