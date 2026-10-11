import type { ZodError } from 'zod';

import type { ValidationIssue } from '@/lib/action-result';

type RawIssue = {
  code: string;
  path: ReadonlyArray<PropertyKey>;
  message: string;
  errors?: ReadonlyArray<ReadonlyArray<RawIssue>>;
};

const toPath = (path: ReadonlyArray<PropertyKey>): Array<string | number> =>
  path.map((segment) => (typeof segment === 'number' ? segment : String(segment)));

/**
 * Zod issues as plain `{ path, code, message }`. A union failure (catalog line
 * or inline line) is replaced by the issues of its closest branch (the one with
 * the fewest), so a bad quantity names `lines.1.quantity` instead of the union.
 */
export const toValidationIssues = (error: ZodError): ValidationIssue[] => {
  const seen = new Set<string>();
  const out: ValidationIssue[] = [];

  const visit = (issue: RawIssue, prefix: ReadonlyArray<PropertyKey>) => {
    const path = [...prefix, ...issue.path];
    if (issue.code === 'invalid_union' && issue.errors?.length) {
      const branches = issue.errors.filter((branch) => branch.length > 0);
      const closest = branches.reduce<ReadonlyArray<RawIssue> | null>(
        (best, branch) => (best === null || branch.length < best.length ? branch : best),
        null,
      );
      if (closest) {
        closest.forEach((nested) => visit(nested, path));
        return;
      }
    }
    const key = `${path.join('.')}|${issue.code}|${issue.message}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ path: toPath(path), code: issue.code, message: issue.message });
  };

  (error.issues as unknown as RawIssue[]).forEach((issue) => visit(issue, []));
  return out;
};
