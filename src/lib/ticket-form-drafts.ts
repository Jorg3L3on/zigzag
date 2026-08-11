'use client';

const TICKET_DRAFT_STORAGE_PREFIX = 'zigzag:ticket-draft:v1';

export type TicketDraftServiceLine = {
  service_id: number;
  quantity: number;
  price: number;
};

export type TicketFormDraft = {
  client_id?: number;
  client_name?: string;
  client_tel?: string;
  email?: string;
  document?: string;
  ticket_date?: string;
  company_id?: number;
  services?: TicketDraftServiceLine[];
  isFullyPaid?: boolean;
  paidAmountInput?: string;
};

export type StoredTicketFormDraft = TicketFormDraft & {
  updatedAt: string;
};

const canUseLocalStorage = (): boolean =>
  typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const cleanNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

const cleanString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined;

const cleanDateString = (value: unknown): string | undefined => {
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }
  return undefined;
};

const cleanServices = (value: unknown): TicketDraftServiceLine[] | undefined => {
  if (!Array.isArray(value)) return undefined;

  return value
    .map((line) => {
      const candidate = line as Partial<TicketDraftServiceLine>;
      const serviceId = cleanNumber(candidate.service_id);
      const quantity = cleanNumber(candidate.quantity);
      const price = cleanNumber(candidate.price);
      if (serviceId == null || quantity == null || price == null) {
        return null;
      }
      return { service_id: serviceId, quantity, price };
    })
    .filter((line): line is TicketDraftServiceLine => line !== null);
};

export function buildTicketDraftStorageKey({
  route,
  ticketId,
  companyId,
}: {
  route: string;
  ticketId?: string | number | null;
  companyId?: number | null;
}): string {
  const normalizedRoute = route.replace(/\?.*$/, '') || '/tickets/create';
  const normalizedTicketId = ticketId == null ? 'new' : String(ticketId);
  const normalizedCompanyId = companyId == null ? 'none' : String(companyId);
  return `${TICKET_DRAFT_STORAGE_PREFIX}:${normalizedRoute}:ticket:${normalizedTicketId}:company:${normalizedCompanyId}`;
}

export function sanitizeTicketFormDraft(
  draft: Partial<Omit<TicketFormDraft, 'ticket_date'>> & {
    ticket_date?: string | Date;
  } & Record<string, unknown>,
): TicketFormDraft {
  const sanitized: TicketFormDraft = {
    client_id: cleanNumber(draft.client_id),
    client_name: cleanString(draft.client_name),
    client_tel: cleanString(draft.client_tel),
    email: cleanString(draft.email),
    document: cleanString(draft.document),
    ticket_date: cleanDateString(draft.ticket_date),
    company_id: cleanNumber(draft.company_id),
    services: cleanServices(draft.services),
    isFullyPaid:
      typeof draft.isFullyPaid === 'boolean' ? draft.isFullyPaid : undefined,
    paidAmountInput: cleanString(draft.paidAmountInput),
  };

  return Object.fromEntries(
    Object.entries(sanitized).filter(([, value]) => value !== undefined),
  ) as TicketFormDraft;
}

export function readTicketFormDraft(key: string): StoredTicketFormDraft | null {
  if (!canUseLocalStorage()) return null;

  const rawValue = window.localStorage.getItem(key);
  if (!rawValue) return null;

  try {
    const parsed = JSON.parse(rawValue) as StoredTicketFormDraft;
    if (typeof parsed.updatedAt !== 'string') return null;

    return {
      ...sanitizeTicketFormDraft(parsed),
      updatedAt: parsed.updatedAt,
    };
  } catch {
    return null;
  }
}

export function writeTicketFormDraft(
  key: string,
  draft: Partial<Omit<TicketFormDraft, 'ticket_date'>> & {
    ticket_date?: string | Date;
  } & Record<string, unknown>,
): void {
  if (!canUseLocalStorage()) return;

  const sanitized = sanitizeTicketFormDraft(draft);
  const payload: StoredTicketFormDraft = {
    ...sanitized,
    updatedAt: new Date().toISOString(),
  };
  window.localStorage.setItem(key, JSON.stringify(payload));
}

export function clearTicketFormDraft(key: string): void {
  if (!canUseLocalStorage()) return;

  window.localStorage.removeItem(key);
}
