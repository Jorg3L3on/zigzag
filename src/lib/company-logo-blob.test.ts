import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  assertBlobTokenConfigured,
  deleteCompanyLogoBlob,
  uploadCompanyLogoBlob,
} from '@/lib/company-logo-blob';
import { AppError } from '@/lib/errors';

describe('company logo blob', () => {
  const originalEnv = process.env.NODE_ENV;
  const originalToken = process.env.BLOB_READ_WRITE_TOKEN;
  const localRoot = path.join(process.cwd(), 'public', 'company-logos', '99');

  afterEach(async () => {
    process.env.NODE_ENV = originalEnv;
    if (originalToken === undefined) {
      delete process.env.BLOB_READ_WRITE_TOKEN;
    } else {
      process.env.BLOB_READ_WRITE_TOKEN = originalToken;
    }
    await rm(localRoot, { recursive: true, force: true });
  });

  it('stores logos under public/company-logos in development without a blob token', async () => {
    process.env.NODE_ENV = 'development';
    delete process.env.BLOB_READ_WRITE_TOKEN;

    const logoUrl = await uploadCompanyLogoBlob(
      99,
      Buffer.from('fake-png-bytes'),
      'image/png',
    );

    expect(logoUrl.startsWith('/company-logos/99/logo-')).toBe(true);
    expect(logoUrl.endsWith('.png')).toBe(true);

    const absolute = path.join(process.cwd(), 'public', logoUrl.replace(/^\//, ''));
    await expect(readFile(absolute)).resolves.toEqual(
      Buffer.from('fake-png-bytes'),
    );

    await deleteCompanyLogoBlob(logoUrl);
    await expect(readFile(absolute)).rejects.toThrow();
  });

  it('throws CO014 when blob storage is required but not configured', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.BLOB_READ_WRITE_TOKEN;

    expect(() => assertBlobTokenConfigured()).toThrow(AppError);
    try {
      assertBlobTokenConfigured();
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).errorCode).toBe('CO014');
    }
  });

  it('ignores deletes for untrusted or legacy static icon paths', async () => {
    await mkdir(localRoot, { recursive: true });
    const decoy = path.join(localRoot, 'keep.txt');
    await writeFile(decoy, 'keep');

    await deleteCompanyLogoBlob('/icons/icon-192.png');
    await deleteCompanyLogoBlob('https://evil.example/logo.png');
    await expect(readFile(decoy, 'utf8')).resolves.toBe('keep');
  });
});
