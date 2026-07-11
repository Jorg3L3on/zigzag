import fs from 'node:fs';
import path from 'node:path';

const SOURCE_ROOT = path.join(process.cwd(), 'src');
const IGNORED_FILES = new Set([
  path.join(SOURCE_ROOT, 'lib/company-entitlements-architecture.test.ts'),
]);

const collectSourceFiles = (directory: string): string[] => {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return collectSourceFiles(fullPath);
    }
    if (!/\.(ts|tsx)$/.test(entry.name) || /\.test\.(ts|tsx)$/.test(entry.name)) {
      return [];
    }
    return [fullPath];
  });
};

describe('company entitlements architecture guard', () => {
  it('does not read commercial plan from settings.plan in production code', () => {
    const offenders = collectSourceFiles(SOURCE_ROOT)
      .filter((filePath) => !IGNORED_FILES.has(filePath))
      .filter((filePath) => {
        const content = fs.readFileSync(filePath, 'utf8');
        return (
          content.includes('settings?.plan') ||
          content.includes('settings.plan') ||
          content.includes('getCompanyPlanId(')
        );
      });

    expect(offenders).toEqual([]);
  });
});
