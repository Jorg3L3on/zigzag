'use client';

/**
 * Local draft for the Nuevo ticket composer (ZIG-I2-4). Lines live in client
 * state until Guardar ticket, so a reload must not lose them. One draft per
 * company; cleared after a successful save.
 */

const TICKET_COMPOSER_DRAFT_PREFIX = 'zigzag:ticket-composer-draft:v1';
const MAX_DRAFT_LINES = 50;

export type TicketComposerDraftLine = {
  key: string;
  service_id: number;
  service_name: string;
  quantity: number;
  price: number;
};

export type TicketComposerDraft = {
  client_id?: number;
  client_label?: string;
  /** ISO string; restored as a Date by the composer. */
  ticket_date?: string;
  work_notes?: string;
  lines: TicketComposerDraftLine[];
};

export type StoredTicketComposerDraft = TicketComposerDraft & {
  updatedAt: string;
};

const canUseLocalStorage = (): boolean => {
  try {
    return (
      typeof window !== 'undefined' &&
      typeof window.localStorage !== 'undefined'
    );
  } catch {
    return false;
  }
};

const cleanPositiveInt = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isInteger(value) && value > 0
    ? value
    : undefined;

const cleanString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined;

const cleanIsoDate = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  return Number.isNaN(Date.parse(value)) ? undefined : value;
};

const cleanLine = (value: unknown): TicketComposerDraftLine | null => {
  if (!value || typeof value !== 'object') return null;
  const line = value as Record<string, unknown>;
  const serviceId = cleanPositiveInt(line.service_id);
  const quantity = cleanPositiveInt(line.quantity);
  const price =
    typeof line.price === 'number' && Number.isFinite(line.price) && line.price >= 0
      ? line.price
      : undefined;
  const key = cleanString(line.key);
  const name = cleanString(line.service_name);
  if (!serviceId || !quantity || price === undefined || !key || name === undefined) {
    return null;
  }
  return { key, service_id: serviceId, service_name: name, quantity, price };
};

export const sanitizeTicketComposerDraft = (
  raw: Record<string, unknown>,
): TicketComposerDraft => {
  const lines = Array.isArray(raw.lines)
    ? raw.lines
        .map(cleanLine)
        .filter((line): line is TicketComposerDraftLine => line !== null)
        .slice(0, MAX_DRAFT_LINES)
    : [];

  const draft: TicketComposerDraft = { lines };
  const clientId = cleanPositiveInt(raw.client_id);
  if (clientId) {
    draft.client_id = clientId;
    const label = cleanString(raw.client_label);
    if (label) draft.client_label = label;
  }
  const ticketDate = cleanIsoDate(raw.ticket_date);
  if (ticketDate) draft.ticket_date = ticketDate;
  const notes = cleanString(raw.work_notes);
  if (notes) draft.work_notes = notes;
  return draft;
};

export const isTicketComposerDraftEmpty = (draft: TicketComposerDraft): boolean =>
  !draft.client_id && draft.lines.length === 0 && !draft.work_notes;

export const buildTicketComposerDraftKey = (companyId: number): string =>
  `${TICKET_COMPOSER_DRAFT_PREFIX}:${companyId}`;

export const readTicketComposerDraft = (
  key: string,
): StoredTicketComposerDraft | null => {
  if (!canUseLocalStorage()) return null;
  try {
    const rawValue = window.localStorage.getItem(key);
    if (!rawValue) return null;
    const parsed = JSON.parse(rawValue) as Record<string, unknown>;
    if (typeof parsed.updatedAt !== 'string') return null;
    return {
      ...sanitizeTicketComposerDraft(parsed),
      updatedAt: parsed.updatedAt,
    };
  } catch {
    return null;
  }
};

export const writeTicketComposerDraft = (
  key: string,
  draft: TicketComposerDraft,
): void => {
  if (!canUseLocalStorage()) return;
  try {
    const sanitized = sanitizeTicketComposerDraft(
      draft as unknown as Record<string, unknown>,
    );
    if (isTicketComposerDraftEmpty(sanitized)) {
      window.localStorage.removeItem(key);
      return;
    }
    const payload: StoredTicketComposerDraft = {
      ...sanitized,
      updatedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(key, JSON.stringify(payload));
  } catch {
    // Storage full or blocked: the composer keeps working without a draft.
  }
};

export const clearTicketComposerDraft = (key: string): void => {
  if (!canUseLocalStorage()) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore blocked storage.
  }
};
