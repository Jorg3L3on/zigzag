/**
 * @jest-environment jsdom
 */

import { describe, expect, it, beforeEach } from '@jest/globals';
import {
  buildAnotarDraftStorageKey,
  clearAnotarFormDraft,
  isMeaningfulAnotarDraft,
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

describe('isMeaningfulAnotarDraft (ZIG-I18-4)', () => {
  it('is false for an empty draft and true once something is typed or chosen', () => {
    expect(isMeaningfulAnotarDraft(null)).toBe(false);
    expect(isMeaningfulAnotarDraft({ paymentMode: 'paid', totalInput: ' ' })).toBe(false);
    expect(isMeaningfulAnotarDraft({ totalInput: '250' })).toBe(true);
    expect(isMeaningfulAnotarDraft({ work_notes: 'Cambio de compresor' })).toBe(true);
    expect(isMeaningfulAnotarDraft({ client_id: 4 })).toBe(true);
  });

  it('keeps total, paid and mode changes in the stored draft', () => {
    writeAnotarFormDraft('k', { totalInput: '300', paidInput: '100', paymentMode: 'partial' });
    expect(readAnotarFormDraft('k')).toMatchObject({
      totalInput: '300',
      paidInput: '100',
      paymentMode: 'partial',
    });
  });
});
