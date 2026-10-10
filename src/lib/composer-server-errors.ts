/**
 * Maps the server's validation issues (which line, which field) to the
 * composer: a message under each rejected line and a toast that names the
 * first ones, so TC009 never points at fields nobody marked (ZIG-I12).
 */
import type { ValidationIssue } from '@/lib/action-result';
import { PRICE_MAX_MESSAGE, QUANTITY_MAX_MESSAGE } from '@/lib/composer-limits';
import { SERVICE_DESCRIPTION_MAX_LENGTH } from '@/lib/service-description';
import { SERVICE_LINE_NAME_MAX_LENGTH } from '@/lib/ticket-service-line-schema';

const FIELD_LABEL: Record<string, string> = {
  quantity: 'Cantidad',
  price: 'Precio',
  name: 'Nombre',
  description: 'Descripción',
};

const LINE_ROOTS = new Set(['lines', 'services']);
const MAX_LISTED = 2;

const describe = (field: string, issue: ValidationIssue): string => {
  if (field === 'quantity') {
    if (issue.code === 'too_big') return QUANTITY_MAX_MESSAGE;
    if (issue.code === 'too_small') return 'Mínimo 0.01';
  }
  if (field === 'price') {
    if (issue.code === 'too_big') return PRICE_MAX_MESSAGE;
    if (issue.code === 'too_small') return 'El precio no puede ser negativo';
  }
  if (field === 'name') {
    if (issue.code === 'too_small') return 'El nombre es obligatorio';
    if (issue.code === 'too_big') return `Máximo ${SERVICE_LINE_NAME_MAX_LENGTH} caracteres`;
  }
  if (field === 'description' && issue.code === 'too_big') {
    return `Máximo ${SERVICE_DESCRIPTION_MAX_LENGTH} caracteres`;
  }
  return issue.message;
};

export type MappedServerIssues = {
  /** Message under each rejected line, by composer line key. */
  rowErrors: Record<string, string>;
  /** Message under the notes field. */
  notesError: string | null;
  /** First issues in one sentence for the toast, or null when none could be placed. */
  summary: string | null;
};

type LineRef = { key: string };

export const mapServerIssues = (
  issues: ReadonlyArray<ValidationIssue> | undefined,
  lines: ReadonlyArray<LineRef>,
): MappedServerIssues => {
  const rowErrors: Record<string, string> = {};
  const listed: string[] = [];
  let notesError: string | null = null;
  let total = 0;

  for (const issue of issues ?? []) {
    const [root, index, ...rest] = issue.path;
    if (typeof root === 'string' && LINE_ROOTS.has(root) && typeof index === 'number') {
      const line = lines[index];
      if (!line) continue;
      // materials.<m>.<field> or <field>
      const isMaterial = rest[0] === 'materials' && typeof rest[1] === 'number';
      const field = String(isMaterial ? rest[2] : rest[0]);
      const prefix = isMaterial ? `Material ${(rest[1] as number) + 1} · ` : '';
      const label = FIELD_LABEL[field] ?? field;
      const detail = `${prefix}${label}: ${describe(field, issue)}`;
      rowErrors[line.key] = rowErrors[line.key] ? `${rowErrors[line.key]} · ${detail}` : detail;
      total += 1;
      if (listed.length < MAX_LISTED) listed.push(`Línea ${index + 1} · ${detail}`);
    } else if (root === 'work_notes') {
      notesError = issue.code === 'too_big' ? 'Notas: máximo 2,000 caracteres' : `Notas: ${issue.message}`;
      total += 1;
      if (listed.length < MAX_LISTED) listed.push(notesError);
    }
  }

  const summary =
    listed.length === 0
      ? null
      : `${listed.join('; ')}${total > listed.length ? ` y ${total - listed.length} más` : ''}`;
  return { rowErrors, notesError, summary };
};
