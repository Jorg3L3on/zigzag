#!/usr/bin/env node
/** Resume/complete field program issue publish. Skips #421 umbrella and #422 if present. */
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
const PROGRAM = 421;
const EXISTING_EPICS = { 'field-bottom-tabs': 422 };

const gh = (args) => execSync(`gh ${args}`, { cwd: ROOT, encoding: 'utf8' }).trim();

const tmpFile = (content) => {
  const p = path.join(os.tmpdir(), `field-issue-${Date.now()}.md`);
  fs.writeFileSync(p, content);
  return p;
};

const createIssue = (title, body) => {
  const bodyPath = tmpFile(body);
  const url = gh(
    `issue create --title ${JSON.stringify(title)} --body-file ${JSON.stringify(bodyPath)} --label ready-for-agent --label type:feature`,
  );
  return Number(url.match(/(\d+)$/)?.[1]);
};

const result = fs.existsSync(OUT_PATH)
  ? JSON.parse(fs.readFileSync(OUT_PATH, 'utf8'))
  : {
      program: PROGRAM,
      programUrl: `https://github.com/Jorg3L3on/zigzag/issues/${PROGRAM}`,
      publishedAt: new Date().toISOString(),
      epics: [],
    };

result.program = PROGRAM;
const sliceTitleToNum = {};
for (const e of result.epics) {
  for (const s of e.slices || []) sliceTitleToNum[s.title] = s.number;
}

for (const epic of [...slices.epics].sort((a, b) => a.order - b.order)) {
  let parentNum = EXISTING_EPICS[epic.slug];
  let epicRecord = result.epics.find((e) => e.slug === epic.slug);

  if (!parentNum) {
    const epicBody = `Source: \`${epic.prdFile}\`\nIntegration branch: \`${epic.branch}\`\nProgram umbrella: #${PROGRAM}\n`;
    parentNum = createIssue(epic.parentTitle, epicBody);
    console.log(`Epic ${epic.slug} #${parentNum}`);
    try {
      gh(
        `issue comment ${PROGRAM} --body ${JSON.stringify(`Epic ${epic.slug} → #${parentNum} branch ${epic.branch}`)}`,
      );
    } catch {
      /* token may lack comment scope */
    }
  } else {
    console.log(`Epic ${epic.slug} reusing #${parentNum}`);
  }

  if (!epicRecord) {
    epicRecord = {
      slug: epic.slug,
      branch: epic.branch,
      prdFile: epic.prdFile,
      parent: parentNum,
      parentUrl: `https://github.com/Jorg3L3on/zigzag/issues/${parentNum}`,
      slices: [],
    };
    result.epics.push(epicRecord);
  }

  for (const slice of epic.slices) {
    if (epicRecord.slices.some((s) => s.title === slice.title)) {
      console.log(`  skip existing: ${slice.title}`);
      continue;
    }

    const blocked =
      slice.blockedBy?.length > 0
        ? slice.blockedBy
            .map((t) => (sliceTitleToNum[t] ? `#${sliceTitleToNum[t]} (${t})` : t))
            .join('\n- ')
        : 'None — start immediately';

    const criteria = slice.acceptanceCriteria.map((c) => `- [ ] ${c}`).join('\n');
    const slugPart = slice.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);

    const body = `## Parent\n\n#${parentNum}\n\n## Program\n\n#${PROGRAM} — read tasks/FIELD-PROGRAM.md\n\n## Integration branch\n\n${epic.branch}\n\n## What to build\n\n${slice.whatToBuild}\n\n## Acceptance criteria\n\n${criteria}\n\n## Blocked by\n\n${blocked.startsWith('None') ? blocked : `- ${blocked}`}\n\n## Agent workflow\n\n1. git fetch origin main && git checkout ${epic.branch} || git checkout -b ${epic.branch} origin/main\n2. git push -u origin ${epic.branch}\n3. git checkout -b slice/${epic.slug}-${slugPart}\n4. npm test -- --runInBand && npm run lint\n5. PR into ${epic.branch} — do not merge to main\n`;

    const sliceNum = createIssue(`Slice [${epic.slug}]: ${slice.title}`, body);
    sliceTitleToNum[slice.title] = sliceNum;
    epicRecord.slices.push({
      number: sliceNum,
      title: slice.title,
      url: `https://github.com/Jorg3L3on/zigzag/issues/${sliceNum}`,
      blockedBy: slice.blockedBy,
    });
    console.log(`  Slice #${sliceNum}: ${slice.title}`);
  }
}

fs.writeFileSync(OUT_PATH, JSON.stringify(result, null, 2));
console.log(`Wrote ${OUT_PATH}`);
