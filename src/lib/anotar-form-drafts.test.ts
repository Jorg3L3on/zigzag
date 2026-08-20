/**
 * @jest-environment jsdom
 */

import { describe, expect, it, beforeEach } from '@jest/globals';
import {
  buildAnotarDraftStorageKey,
  clearAnotarFormDraft,
  readAnotarFormDraft,
  writeAnotarFormDraft,
} from '@/lib/anotar-form-drafts';

describe('anotar-form-drafts', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('round-trips a draft for a company key', () => {
    const key = buildAnotarDraftStorageKey(42);
    writeAnotarFormDraft(key, {
      client_name: 'Ana',
      client_tel: '5512345678',
      work_notes: 'Filtro',
      totalInput: '150',
      paymentMode: 'partial',
      paidInput: '50',
      company_id: 42,
    });

    const draft = readAnotarFormDraft(key);
    expect(draft?.client_name).toBe('Ana');
    expect(draft?.work_notes).toBe('Filtro');
    expect(draft?.paymentMode).toBe('partial');
    expect(draft?.updatedAt).toBeTruthy();

    clearAnotarFormDraft(key);
    expect(readAnotarFormDraft(key)).toBeNull();
  });
});
