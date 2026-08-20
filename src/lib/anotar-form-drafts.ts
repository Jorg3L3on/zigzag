'use client';

const ANOTAR_DRAFT_STORAGE_PREFIX = 'zigzag:anotar-draft:v1';

export type AnotarFormDraft = {
  client_id?: number;
  client_name?: string;
  client_tel?: string;
  work_notes?: string;
  totalInput?: string;
  paidInput?: string;
  paymentMode?: 'paid' | 'partial' | 'pending';
  company_id?: number;
};

export type StoredAnotarFormDraft = AnotarFormDraft & {
  updatedAt: string;
};

const canUseLocalStorage = (): boolean =>
  typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const cleanNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

const cleanString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined;

const cleanPaymentMode = (
  value: unknown,
): AnotarFormDraft['paymentMode'] | undefined => {
  if (value === 'paid' || value === 'partial' || value === 'pending') {
    return value;
  }
  return undefined;
};

export const buildAnotarDraftStorageKey = (companyId: number): string =>
  `${ANOTAR_DRAFT_STORAGE_PREFIX}:${companyId}`;

const sanitizeAnotarFormDraft = (
  draft: Record<string, unknown>,
): AnotarFormDraft => {
  const sanitized: AnotarFormDraft = {
    client_id: cleanNumber(draft.client_id),
    client_name: cleanString(draft.client_name),
    client_tel: cleanString(draft.client_tel),
    work_notes: cleanString(draft.work_notes),
    totalInput: cleanString(draft.totalInput),
    paidInput: cleanString(draft.paidInput),
    paymentMode: cleanPaymentMode(draft.paymentMode),
    company_id: cleanNumber(draft.company_id),
  };

  return Object.fromEntries(
    Object.entries(sanitized).filter(([, value]) => value !== undefined),
  ) as AnotarFormDraft;
};

export const readAnotarFormDraft = (
  key: string,
): StoredAnotarFormDraft | null => {
  if (!canUseLocalStorage()) return null;

  const rawValue = window.localStorage.getItem(key);
  if (!rawValue) return null;

  try {
    const parsed = JSON.parse(rawValue) as StoredAnotarFormDraft;
    if (typeof parsed.updatedAt !== 'string') return null;
    return {
      ...sanitizeAnotarFormDraft(parsed),
      updatedAt: parsed.updatedAt,
    };
  } catch {
    return null;
  }
};

export const writeAnotarFormDraft = (
  key: string,
  draft: Partial<AnotarFormDraft>,
): void => {
  if (!canUseLocalStorage()) return;

  const sanitized = sanitizeAnotarFormDraft(draft);
  const payload: StoredAnotarFormDraft = {
    ...sanitized,
    updatedAt: new Date().toISOString(),
  };
  window.localStorage.setItem(key, JSON.stringify(payload));
};

export const clearAnotarFormDraft = (key: string): void => {
  if (!canUseLocalStorage()) return;
  window.localStorage.removeItem(key);
};
