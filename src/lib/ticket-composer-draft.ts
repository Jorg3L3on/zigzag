'use client';

/**
 * Local draft for the Nuevo ticket composer (ZIG-I2-4). Lines live in client
 * state until Guardar ticket, so a reload must not lose them. One draft per
 * company; cleared after a successful save.
 */

import { SERVICE_DESCRIPTION_MAX_LENGTH } from '@/lib/service-description';
import {
  SERVICE_LINE_NAME_MAX_LENGTH,
  type ServiceLineInput,
} from '@/lib/ticket-service-line-schema';

const TICKET_COMPOSER_DRAFT_PREFIX = 'zigzag:ticket-composer-draft:v1';
/** Nuevo presupuesto keeps its own draft so it never mixes with a ticket draft. */
const PRESUPUESTO_COMPOSER_DRAFT_PREFIX = 'zigzag:presupuesto-composer-draft:v1';
const MAX_DRAFT_LINES = 50;

/**
 * One composer line. Catalog lines carry `service_id`; inline lines (ZIG-I5)
 * have `kind: 'custom'`, `service_id: null`, their own name/description and the
 * Guardar en mi catálogo flag. Drafts written before ZIG-I5 have no `kind` and
 * read back as catalog lines.
 */
export type TicketComposerDraftLine = {
  key: string;
  kind?: 'catalog' | 'custom';
  service_id: number | null;
  service_name: string;
  description?: string;
  save_to_catalog?: boolean;
  quantity: number;
  price: number;
};

export type TicketComposerDraft = {
  client_id?: number;
  client_label?: string;
  /** ISO string; restored as a Date by the composer. */
  ticket_date?: string;
  /** Presupuestos only: ISO string; absent means Sin vencimiento. */
  expires_at?: string;
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
  const quantity = cleanPositiveInt(line.quantity);
  const price =
    typeof line.price === 'number' && Number.isFinite(line.price) && line.price >= 0
      ? line.price
      : undefined;
  const key = cleanString(line.key);
  const name = cleanString(line.service_name);
  if (!quantity || price === undefined || !key || name === undefined) {
    return null;
  }
  if (line.kind === 'custom') {
    const customName = name.trim().slice(0, SERVICE_LINE_NAME_MAX_LENGTH);
    if (!customName) return null;
    const description = cleanString(line.description)?.slice(
      0,
      SERVICE_DESCRIPTION_MAX_LENGTH,
    );
    return {
      key,
      kind: 'custom',
      service_id: null,
      service_name: customName,
      ...(description ? { description } : {}),
      save_to_catalog: line.save_to_catalog === true,
      quantity,
      price,
    };
  }
  const serviceId = cleanPositiveInt(line.service_id);
  if (!serviceId) return null;
  return { key, service_id: serviceId, service_name: name, quantity, price };
};

/** Draft line → the server's line input (catalog or inline). */
export const draftLineToServiceLineInput = (
  line: TicketComposerDraftLine,
): ServiceLineInput =>
  line.kind === 'custom' || line.service_id == null
    ? {
        kind: 'custom',
        name: line.service_name,
        description: line.description,
        save_to_catalog: line.save_to_catalog === true,
        quantity: line.quantity,
        price: line.price,
      }
    : { service_id: line.service_id, quantity: line.quantity, price: line.price };

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
  const expiresAt = cleanIsoDate(raw.expires_at);
  if (expiresAt) draft.expires_at = expiresAt;
  const notes = cleanString(raw.work_notes);
  if (notes) draft.work_notes = notes;
  return draft;
};

export const isTicketComposerDraftEmpty = (draft: TicketComposerDraft): boolean =>
  !draft.client_id &&
  draft.lines.length === 0 &&
  !draft.work_notes &&
  !draft.expires_at;

export const buildTicketComposerDraftKey = (companyId: number): string =>
  `${TICKET_COMPOSER_DRAFT_PREFIX}:${companyId}`;

export const buildPresupuestoComposerDraftKey = (companyId: number): string =>
  `${PRESUPUESTO_COMPOSER_DRAFT_PREFIX}:${companyId}`;

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
