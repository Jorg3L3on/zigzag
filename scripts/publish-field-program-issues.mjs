#!/usr/bin/env node
/**
 * Publish field program GitHub issues from tasks/field-program-slices.json
 * Usage: node scripts/publish-field-program-issues.mjs
 * Output: tasks/field-program-issues.json
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SLICES_PATH = path.join(ROOT, 'tasks/field-program-slices.json');
const OUT_PATH = path.join(ROOT, 'tasks/field-program-issues.json');

const slices = JSON.parse(fs.readFileSync(SLICES_PATH, 'utf8'));

const gh = (args) =>
  execSync(`gh ${args}`, { cwd: ROOT, encoding: 'utf8' }).trim();

const tmpFile = (content) => {
  const p = path.join(os.tmpdir(), `field-issue-${Date.now()}-${Math.random()}.md`);
  fs.writeFileSync(p, content);
  return p;
};

const createIssue = (title, body) => {
  const bodyPath = tmpFile(body);
  const url = gh(
    `issue create --title ${JSON.stringify(title)} --body-file ${JSON.stringify(bodyPath)} --label ready-for-agent --label type:feature`,
  );
  const num = Number(url.match(/(\d+)$/)?.[1]);
  if (!num) throw new Error(`Failed to parse issue number from: ${url}`);
  return num;
};

const umbrellaBody = `# Field program — first customer

**Agent entry:** \`tasks/FIELD-PROGRAM.md\`

Discovery: \`tasks/prd-first-customer-field-technician.md\`
Decisions: \`tasks/prd-field-program-decisions.md\`

Pick a **slice issue** (child of an epic parent). Do not implement from this umbrella directly.

Epic order: bottom-tabs → solo-mode → offline → anotar → send-cobro
`;

const programNum = createIssue(
  slices.programTitle || 'PRD: Field program — first customer (umbrella)',
  umbrellaBody,
);
console.log(`Program umbrella #${programNum}`);

const result = {
  program: programNum,
  programUrl: `https://github.com/Jorg3L3on/zigzag/issues/${programNum}`,
  publishedAt: new Date().toISOString(),
  epics: [],
};

const sliceTitleToNum = {};

for (const epic of [...slices.epics].sort((a, b) => a.order - b.order)) {
  const epicBody = `Source: \`${epic.prdFile}\`
Integration branch: \`${epic.branch}\`
Program umbrella: #${programNum}

Read the PRD file for full user stories. Implement **slice issues** (children).
PR base branch: \`${epic.branch}\`.
`;

  const parentNum = createIssue(epic.parentTitle, epicBody);
  gh(
    `issue comment ${programNum} --body ${JSON.stringify(`Epic **${epic.slug}** → #${parentNum} (branch ${epic.branch})`)}`,
  );
  console.log(`Epic ${epic.slug} #${parentNum}`);

  const epicRecord = {
    slug: epic.slug,
    branch: epic.branch,
    prdFile: epic.prdFile,
    parent: parentNum,
    parentUrl: `https://github.com/Jorg3L3on/zigzag/issues/${parentNum}`,
    slices: [],
  };

  for (const slice of epic.slices) {
    const blocked =
      slice.blockedBy?.length > 0
        ? slice.blockedBy
            .map((t) => {
              const n = sliceTitleToNum[t];
              return n ? `#${n} (${t})` : t;
            })
            .join('\n- ')
        : 'None — start immediately';

    const criteria = slice.acceptanceCriteria.map((c) => `- [ ] ${c}`).join('\n');
    const slugPart = slice.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .slice(0, 40);

    const body = `## Parent

#${parentNum}

## Program

#${programNum} — read \`tasks/FIELD-PROGRAM.md\`

## Integration branch

\`${epic.branch}\`

## What to build

${slice.whatToBuild}

## Acceptance criteria

${criteria}

## Blocked by

${blocked.startsWith('None') ? blocked : `- ${blocked}`}

## Agent workflow

1. \`git fetch origin main && git checkout ${epic.branch} 2>/dev/null || (git checkout main && git pull && git checkout -b ${epic.branch})\`
2. \`git push -u origin ${epic.branch}\` (first slice only)
3. \`git checkout -b slice/${epic.slug}-${slugPart}\`
4. \`npm test -- --runInBand\` · \`npm run lint\` · mobile E2E if PRD requires
5. Open PR into \`${epic.branch}\` — do **not** merge to \`main\`
`;

    const sliceNum = createIssue(`Slice [${epic.slug}]: ${slice.title}`, body);
    sliceTitleToNum[slice.title] = sliceNum;
    console.log(`  Slice #${sliceNum}: ${slice.title}`);

    epicRecord.slices.push({
      number: sliceNum,
      title: slice.title,
      url: `https://github.com/Jorg3L3on/zigzag/issues/${sliceNum}`,
      blockedBy: slice.blockedBy,
    });
  }

  result.epics.push(epicRecord);
}

fs.writeFileSync(OUT_PATH, JSON.stringify(result, null, 2));
console.log(`\nWrote ${OUT_PATH}`);
