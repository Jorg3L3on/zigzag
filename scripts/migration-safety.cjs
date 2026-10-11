/**
 * Flag SQL migrations that can lose or rewrite existing data.
 *
 * A migration with a risky statement must carry an explicit approval line:
 *   -- data-loss-ok: <why this is safe, e.g. column unused since #123 and backed up>
 * The check only looks at migration files a pull request adds or changes, so
 * migrations that already shipped are not re-judged.
 */

const RULES = [
  { id: 'DROP TABLE', pattern: /\bDROP\s+TABLE\b/i },
  { id: 'DROP COLUMN', pattern: /\bDROP\s+COLUMN\b/i },
  { id: 'DROP SCHEMA', pattern: /\bDROP\s+SCHEMA\b/i },
  { id: 'DROP DATABASE', pattern: /\bDROP\s+DATABASE\b/i },
  { id: 'TRUNCATE', pattern: /\bTRUNCATE\b/i },
  { id: 'DELETE FROM', pattern: /\bDELETE\s+FROM\b/i },
  { id: 'UPDATE ... SET', pattern: /\bUPDATE\s+(?:ONLY\s+)?[\w."]+\s+(?:AS\s+\w+\s+)?SET\b/i },
  { id: 'ALTER COLUMN ... TYPE', pattern: /\bALTER\s+COLUMN\s+[\w"]+\s+(?:SET\s+DATA\s+)?TYPE\b/i },
];

const APPROVAL = /^[ \t]*--[ \t]*data-loss-ok:[ \t]*\S/m;

/** Blank out comments and string literals, keeping newlines so line numbers stay true. */
const stripSql = (sql) =>
  sql
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/--[^\n]*/g, (m) => ' '.repeat(m.length))
    .replace(/'(?:[^']|'')*'/g, (m) => m.replace(/[^\n]/g, ' '));

/** @returns {{ rule: string, line: number, text: string }[]} */
const findRisks = (sql) => {
  const stripped = stripSql(sql);
  const lines = stripped.split('\n');
  const original = sql.split('\n');
  const risks = [];
  for (const { id, pattern } of RULES) {
    const match = pattern.exec(stripped);
    if (!match) {
      continue;
    }
    const line = stripped.slice(0, match.index).split('\n').length;
    risks.push({ rule: id, line, text: (original[line - 1] ?? lines[line - 1]).trim() });
  }
  return risks.sort((a, b) => a.line - b.line);
};

const hasApproval = (sql) => APPROVAL.test(sql);

/**
 * @param {{ path: string, sql: string }[]} files
 * @returns {{ violations: { path: string, risks: ReturnType<typeof findRisks> }[], approved: string[] }}
 */
const evaluateMigrations = (files) => {
  const violations = [];
  const approved = [];
  for (const { path, sql } of files) {
    const risks = findRisks(sql);
    if (risks.length === 0) {
      continue;
    }
    if (hasApproval(sql)) {
      approved.push(path);
    } else {
      violations.push({ path, risks });
    }
  }
  return { violations, approved };
};

const formatViolations = (violations) =>
  [
    'Migration safety check failed: these migrations can lose or rewrite existing data.',
    '',
    ...violations.flatMap(({ path, risks }) => [
      `  ${path}`,
      ...risks.map((r) => `    line ${r.line}: ${r.rule}  ${r.text}`),
    ]),
    '',
    'If the statement is intended and safe (data backed up, column unused), add a line to the',
    'migration explaining why, then push again:',
    '  -- data-loss-ok: <reason>',
    'Prefer additive changes: add the new column now, drop the old one in a later release.',
  ].join('\n');

module.exports = { RULES, findRisks, hasApproval, evaluateMigrations, formatViolations, stripSql };
