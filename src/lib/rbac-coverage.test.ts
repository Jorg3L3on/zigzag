import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const fullPath = path.join(dir, entry);
    return statSync(fullPath).isDirectory() ? walk(fullPath) : [fullPath];
  });

const read = (filePath: string) => readFileSync(filePath, 'utf8');

const relative = (filePath: string) => path.relative(root, filePath);

const hasAny = (content: string, tokens: string[]) =>
  tokens.some((token) => content.includes(token));

const nearestLayouts = (pagePath: string): string[] => {
  const dashboardRoot = path.join(root, 'src/app/dashboard');
  const layouts: string[] = [];
  let dir = path.dirname(pagePath);

  while (dir.startsWith(dashboardRoot)) {
    const layoutPath = path.join(dir, 'layout.tsx');
    if (existsSync(layoutPath)) {
      layouts.push(layoutPath);
    }
    if (dir === dashboardRoot) {
      break;
    }
    dir = path.dirname(dir);
  }

  return layouts;
};

describe('RBAC coverage', () => {
  it('keeps domain server actions behind authorization helpers', () => {
    const actionFiles = walk(path.join(root, 'src/actions')).filter((filePath) =>
      filePath.endsWith('.ts'),
    );
    const allowedExceptions = new Set(['src/actions/authz.ts']);

    const missing = actionFiles
      .filter((filePath) => !allowedExceptions.has(relative(filePath)))
      .filter((filePath) => {
        const content = read(filePath);
        return !hasAny(content, [
          'requireActionPermission(',
          'checkPermission(',
          'requireScheduleRead(',
          'requireScheduleWrite(',
        ]);
      })
      .map(relative);

    expect(missing).toEqual([]);
  });

  it('keeps non-public API routes behind API authorization helpers', () => {
    const routeFiles = walk(path.join(root, 'src/app/api')).filter((filePath) =>
      filePath.endsWith('/route.ts'),
    );
    const allowedPublicRoutes = new Set([
      'src/app/api/auth/[...nextauth]/route.ts',
      'src/app/api/health/route.ts',
    ]);

    const missing = routeFiles
      .filter((filePath) => !allowedPublicRoutes.has(relative(filePath)))
      .filter((filePath) => {
        const content = read(filePath);
        return !hasAny(content, ['requireApiPermission(', 'requireSession(']);
      })
      .map(relative);

    expect(missing).toEqual([]);
  });

  it('keeps restricted dashboard pages behind page-level RBAC', () => {
    const dashboardRoot = path.join(root, 'src/app/dashboard');
    const pageFiles = walk(dashboardRoot).filter((filePath) =>
      filePath.endsWith('/page.tsx'),
    );
    const authOnlyPages = new Set([
      'src/app/dashboard/account/page.tsx',
      'src/app/dashboard/forbidden/page.tsx',
    ]);

    const missing = pageFiles
      .filter((filePath) => !authOnlyPages.has(relative(filePath)))
      .filter((filePath) => {
        const pageAndLayouts = [filePath, ...nearestLayouts(filePath)];
        return !pageAndLayouts.some((candidate) =>
          read(candidate).includes('requirePagePermission('),
        );
      })
      .map(relative);

    expect(missing).toEqual([]);
  });

  it('keeps auth-only dashboard exceptions behind active-session validation', () => {
    const dashboardLayout = read(path.join(root, 'src/app/dashboard/layout.tsx'));
    expect(dashboardLayout).toContain('requireActionAuth(');
  });
});
