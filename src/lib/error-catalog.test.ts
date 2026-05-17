import { ERROR_CATALOG } from '@/lib/error-catalog';
import {
  AppError,
  AuthorizationError,
  buildActionError,
  buildPublicError,
} from '@/lib/errors';

describe('error catalog', () => {
  it('uses unique codes that match the catalog key', () => {
    const entries = Object.entries(ERROR_CATALOG);
    const codes = entries.map(([, entry]) => entry.code);

    expect(new Set(codes).size).toBe(codes.length);
    entries.forEach(([key, entry]) => {
      expect(entry.code).toBe(key);
    });
  });

  it('defines user-facing Spanish text and a supported type for every entry', () => {
    Object.values(ERROR_CATALOG).forEach((entry) => {
      expect(entry.title.trim()).not.toBe('');
      expect(entry.message.trim()).not.toBe('');
      expect(['network', 'auth', 'validation', 'server', 'unknown']).toContain(
        entry.type,
      );
    });
  });
});

describe('coded error builders', () => {
  it('builds a public payload from a known code', () => {
    expect(buildPublicError('TC001')).toEqual({
      error: 'Revisa la información del ticket e intenta de nuevo. Código: TC001',
      errorCode: 'TC001',
      errorTitle: 'No se pudo crear el ticket',
      errorType: 'server',
    });
  });

  it('preserves operation code but classifies auth causes', () => {
    const error = new AuthorizationError('forbidden');

    expect(buildActionError('TC001', error)).toMatchObject({
      success: false,
      errorCode: 'TC001',
      errorType: 'auth',
    });
  });

  it('keeps generic app errors as server failures', () => {
    const error = new AppError('unexpected', 500);

    expect(buildActionError('TC001', error)).toMatchObject({
      success: false,
      errorCode: 'TC001',
      errorType: 'server',
    });
  });
});
