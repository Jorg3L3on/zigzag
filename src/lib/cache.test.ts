const unstableCacheMock = jest.fn();
const revalidateTagMock = jest.fn();

jest.mock('next/cache', () => ({
  unstable_cache: (fn: (...args: unknown[]) => unknown) => {
    unstableCacheMock(fn);
    return fn;
  },
  revalidateTag: (tag: string) => revalidateTagMock(tag),
}));

import {
  companyCacheTag,
  createCompanyCache,
  invalidateCompanyCache,
} from '@/lib/cache';

describe('cache helpers', () => {
  beforeEach(() => {
    unstableCacheMock.mockClear();
    revalidateTagMock.mockClear();
  });

  it('builds deterministic company cache tags', () => {
    expect(companyCacheTag(7, 'dashboard')).toBe('company:7:dashboard');
    expect(companyCacheTag('7', 'dashboard')).toBe('company:7:dashboard');
    expect(companyCacheTag(7, 'usage')).toBe('company:7:usage');
  });

  it('createCompanyCache forwards args to the loader', async () => {
    const loader = jest.fn(async (companyId: number, scale: number) => companyId * scale);
    const cached = createCompanyCache(loader, 'dashboard');

    await expect(cached(3, 4)).resolves.toBe(12);
    expect(loader).toHaveBeenCalledWith(3, 4);
    expect(unstableCacheMock).toHaveBeenCalled();
  });

  it('invalidateCompanyCache revalidates the matching tag', () => {
    invalidateCompanyCache(5, 'dashboard');
    expect(revalidateTagMock).toHaveBeenCalledWith('company:5:dashboard');
  });

  it('invalidateCompanyCache is a no-op for null/undefined company', () => {
    invalidateCompanyCache(null, 'dashboard');
    invalidateCompanyCache(undefined, 'usage');
    expect(revalidateTagMock).not.toHaveBeenCalled();
  });
});
