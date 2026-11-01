/**
 * jsdom has no Fetch API Response; a minimal one with what the warm-up reads.
 * (The node environment crashes this repo's jest setup under Node 26.)
 */
class TestResponse {
  readonly status: number;
  readonly statusText: string;
  readonly headers: Headers;
  readonly redirected = false;
  constructor(
    private readonly body: string,
    init: { status?: number; statusText?: string; headers?: HeadersInit } = {},
  ) {
    this.status = init.status ?? 200;
    this.statusText = init.statusText ?? 'OK';
    this.headers = new Headers(init.headers);
  }
  get ok() {
    return this.status >= 200 && this.status < 300;
  }
  clone() {
    return new TestResponse(this.body, { status: this.status, headers: this.headers });
  }
  async text() {
    return this.body;
  }
}
if (typeof globalThis.Response === 'undefined') {
  (globalThis as unknown as { Response: unknown }).Response = TestResponse;
}

import {
  clearComposerPageCaches,
  COMPOSER_WARM_INTERVAL_MS,
  extractStaticAssetPaths,
  warmComposerPages,
} from '@/lib/offline-composer-cache';

class FakeCache {
  entries = new Map<string, Response>();
  async put(key: string, response: Response) {
    this.entries.set(key, response);
  }
  async match(key: string) {
    return this.entries.get(key);
  }
}

const fakeCacheStorage = () => {
  const caches = new Map<string, FakeCache>();
  const storage = {
    open: async (name: string) => {
      if (!caches.has(name)) caches.set(name, new FakeCache());
      return caches.get(name)!;
    },
    delete: async (name: string) => caches.delete(name),
  };
  return { caches, storage: storage as unknown as CacheStorage };
};

const html = `<!doctype html><html><head>
<link rel="stylesheet" href="/_next/static/css/app-abc123.css" />
<script src="/_next/static/chunks/main-1a2b.js" async></script>
<script>self.__next_f.push([1,"\\"/_next/static/chunks/app/tickets/create/page-9f.js\\""])</script>
</head><body></body></html>`;

const memoryStorage = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
  };
};

const page = (body: string, init: { redirected?: boolean; type?: string; vary?: boolean } = {}) => {
  const response = new Response(body, {
    status: 200,
    headers: {
      'content-type': init.type ?? 'text/html; charset=utf-8',
      ...(init.vary ? { vary: 'RSC, Next-Router-State-Tree' } : {}),
    },
  });
  if (init.redirected) Object.defineProperty(response, 'redirected', { value: true });
  return response;
};

describe('offline composer cache warm-up (ZIG-I35-2)', () => {
  it('finds every _next/static script and stylesheet in the page once', () => {
    expect(extractStaticAssetPaths(html + html).sort()).toEqual([
      '/_next/static/chunks/app/tickets/create/page-9f.js',
      '/_next/static/chunks/main-1a2b.js',
      '/_next/static/css/app-abc123.css',
    ]);
  });

  it('stores both composer pages without Vary, and their assets in the SW caches', async () => {
    const { caches, storage } = fakeCacheStorage();
    const fetchImpl = jest.fn(async (url: RequestInfo | URL) => {
      const path = String(url);
      return path.startsWith('/_next/') ? page('x', { type: 'text/javascript' }) : page(html, { vary: true });
    });

    const stored = await warmComposerPages({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      cacheStorage: storage,
      controlled: true,
      storage: memoryStorage(),
      now: COMPOSER_WARM_INTERVAL_MS * 10,
    });

    expect(stored).toEqual(['/tickets/create', '/presupuestos/create']);
    const pages = caches.get('pages')!;
    expect(pages.entries.get('/tickets/create')?.headers.get('vary')).toBeNull();
    expect([...caches.get('next-static-js-assets')!.entries.keys()].sort()).toEqual([
      '/_next/static/chunks/app/tickets/create/page-9f.js',
      '/_next/static/chunks/main-1a2b.js',
    ]);
    expect([...caches.get('static-style-assets')!.entries.keys()]).toEqual([
      '/_next/static/css/app-abc123.css',
    ]);
  });

  it('skips a redirect (expired session or no permission) and does nothing without a service worker', async () => {
    const { caches, storage } = fakeCacheStorage();
    const redirected = jest.fn(async () => page('<html>login</html>', { redirected: true }));
    expect(
      await warmComposerPages({
        fetchImpl: redirected as unknown as typeof fetch,
        cacheStorage: storage,
        controlled: true,
        storage: memoryStorage(),
      }),
    ).toEqual([]);
    expect(caches.get('pages')?.entries.size ?? 0).toBe(0);

    const neverCalled = jest.fn();
    expect(
      await warmComposerPages({
        fetchImpl: neverCalled as unknown as typeof fetch,
        cacheStorage: storage,
        controlled: false,
      }),
    ).toEqual([]);
    expect(neverCalled).not.toHaveBeenCalled();
  });

  it('runs at most once per interval', async () => {
    const { storage } = fakeCacheStorage();
    const kv = memoryStorage();
    const fetchImpl = jest.fn(async () => page(html));
    const env = {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      cacheStorage: storage,
      controlled: true,
      storage: kv,
    };
    await warmComposerPages({ ...env, now: COMPOSER_WARM_INTERVAL_MS * 10 });
    const calls = fetchImpl.mock.calls.length;
    expect(await warmComposerPages({ ...env, now: COMPOSER_WARM_INTERVAL_MS * 10 + 60_000 })).toEqual([]);
    expect(fetchImpl.mock.calls.length).toBe(calls);
    expect(
      await warmComposerPages({ ...env, now: COMPOSER_WARM_INTERVAL_MS * 10 + COMPOSER_WARM_INTERVAL_MS + 1 }),
    ).toHaveLength(2);
  });

  it('logout deletes the cached pages', async () => {
    const { caches, storage } = fakeCacheStorage();
    await storage.open('pages');
    await storage.open('others');
    await storage.open('next-static-js-assets');
    await clearComposerPageCaches(storage);
    expect([...caches.keys()]).toEqual(['next-static-js-assets']);
  });
});
