'use client';

/**
 * Local draft for the Nuevo ticket composer (ZIG-I2-4). Lines live in client
 * state until Guardar ticket, so a reload must not lose them. One draft per
 * company; cleared after a successful save.
 */

import {
  materialDraftToLineInput,
  type MaterialDraft,
} from '@/lib/material-drafts';
import { SERVICE_DESCRIPTION_MAX_LENGTH } from '@/lib/service-description';
import {
  MATERIAL_NAME_MAX_LENGTH,
  MATERIAL_UNIT_MAX_LENGTH,
  MATERIALS_PER_LINE_MAX,
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
  /** Materials under the line (ZIG-I10); absent in drafts from before it. */
  materials?: MaterialDraft[];
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

const cleanMaterial = (value: unknown): MaterialDraft | null => {
  if (!value || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;
  const key = cleanString(item.key);
  const name = cleanString(item.name)?.trim().slice(0, MATERIAL_NAME_MAX_LENGTH);
  const quantity =
    typeof item.quantity === 'number' &&
    Number.isFinite(item.quantity) &&
    item.quantity >= 0.01 &&
    item.quantity <= 9999.99
      ? item.quantity
      : undefined;
  const price =
    typeof item.price === 'number' && Number.isFinite(item.price) && item.price >= 0
      ? item.price
      : undefined;
  if (!key || !name || quantity === undefined || price === undefined) return null;
  const unit = cleanString(item.unit)?.trim().slice(0, MATERIAL_UNIT_MAX_LENGTH);
  const materialId = cleanPositiveInt(item.material_id) ?? null;
  return {
    key,
    material_id: materialId,
    name,
    unit: unit || null,
    quantity,
    price,
    save_to_catalog: materialId == null && item.save_to_catalog === true,
  };
};

const cleanMaterials = (value: unknown): MaterialDraft[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const materials = value
    .map(cleanMaterial)
    .filter((item): item is MaterialDraft => item !== null)
    .slice(0, MATERIALS_PER_LINE_MAX);
  return materials.length > 0 ? materials : undefined;
};

/** Service quantities allow two decimals since migration 0030 (ZIG-I12). */
const cleanServiceQuantity = (value: unknown): number | undefined =>
  typeof value === 'number' &&
  Number.isFinite(value) &&
  value >= 0.01 &&
  value <= 9999.99
    ? Math.round(value * 100) / 100
    : undefined;

const cleanLine = (value: unknown): TicketComposerDraftLine | null => {
  if (!value || typeof value !== 'object') return null;
  const line = value as Record<string, unknown>;
  const quantity = cleanServiceQuantity(line.quantity);
  const price =
    typeof line.price === 'number' && Number.isFinite(line.price) && line.price >= 0
      ? line.price
      : undefined;
  const key = cleanString(line.key);
  const name = cleanString(line.service_name);
  if (!quantity || price === undefined || !key || name === undefined) {
    return null;
  }
  const materials = cleanMaterials(line.materials);
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
      ...(materials ? { materials } : {}),
    };
  }
  const serviceId = cleanPositiveInt(line.service_id);
  if (!serviceId) return null;
  return {
    key,
    service_id: serviceId,
    service_name: name,
    quantity,
    price,
    ...(materials ? { materials } : {}),
  };
};

/** Draft line → the server's line input (catalog or inline) with its materials. */
export const draftLineToServiceLineInput = (
  line: TicketComposerDraftLine,
): ServiceLineInput => {
  const materials = (line.materials ?? []).map(materialDraftToLineInput);
  const withMaterials = materials.length > 0 ? { materials } : {};
  return line.kind === 'custom' || line.service_id == null
    ? {
        kind: 'custom',
        name: line.service_name,
        description: line.description,
        save_to_catalog: line.save_to_catalog === true,
        quantity: line.quantity,
        price: line.price,
        ...withMaterials,
      }
    : {
        service_id: line.service_id,
        quantity: line.quantity,
        price: line.price,
        ...withMaterials,
      };
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
