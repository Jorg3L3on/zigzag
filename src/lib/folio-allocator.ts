import { eq, sql } from 'drizzle-orm';
import { company, documentFolioCounter } from '@/db/schema';
import { resolveFolioPrefix } from '@/lib/folio';
import { normalizeTicketDocumentKind } from '@/lib/ticket-document-kind';

/** Minimal slice of a Drizzle db/transaction the allocator needs. */
type FolioExecutor = {
  insert: typeof import('@/lib/db').db.insert;
  select: typeof import('@/lib/db').db.select;
};

export type AllocatedFolio = {
  folio_number: number;
  folio_prefix: string;
};

/**
 * Hands out the next folio of a company's series. Call it inside the same
 * transaction that inserts the Ticket: the counter row is locked until commit,
 * so two concurrent creations in one company can never get the same number, and
 * a rolled back insert gives its number back.
 */
export const allocateDocumentFolio = async (
  tx: FolioExecutor,
  params: { companyId: number; documentKind: string | null | undefined },
): Promise<AllocatedFolio> => {
  const kind = normalizeTicketDocumentKind(params.documentKind);

  const [counter] = await tx
    .insert(documentFolioCounter)
    .values({
      company_id: params.companyId,
      document_kind: kind,
      last_number: 1,
    })
    .onConflictDoUpdate({
      target: [documentFolioCounter.company_id, documentFolioCounter.document_kind],
      set: { last_number: sql`${documentFolioCounter.last_number} + 1` },
    })
    .returning({ last_number: documentFolioCounter.last_number });

  const [row] = await tx
    .select({ settings: company.settings })
    .from(company)
    .where(eq(company.id, params.companyId))
    .limit(1);

  return {
    folio_number: counter.last_number,
    folio_prefix: resolveFolioPrefix(kind, row?.settings),
  };
};

/**
 * The numbers the next presupuesto and recibo of a company will get, for the
 * "El siguiente será…" hint in Mi empresa (ZIG-I32-1). Read-only: the counter
 * only moves inside `allocateDocumentFolio`.
 */
export const readNextFolioNumbers = async (
  executor: Pick<FolioExecutor, 'select'>,
  companyId: number,
): Promise<{ presupuesto: number; ticket: number }> => {
  const rows = await executor
    .select({
      document_kind: documentFolioCounter.document_kind,
      last_number: documentFolioCounter.last_number,
    })
    .from(documentFolioCounter)
    .where(eq(documentFolioCounter.company_id, companyId));
  const last = (kind: string) =>
    rows.find((row) => row.document_kind === kind)?.last_number ?? 0;
  return { presupuesto: last('presupuesto') + 1, ticket: last('ticket') + 1 };
};
