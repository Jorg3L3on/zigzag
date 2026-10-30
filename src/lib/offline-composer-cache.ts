'use client';

/**
 * Lets Nuevo ticket and Nuevo presupuesto open with no signal (ZIG-I35-2).
 *
 * The service worker (src/app/sw.ts) serves navigations network-first from the
 * `pages` cache and `_next/static` files from their caches, but only for what
 * was loaded before. While online, the app fetches the two composer pages and
 * the JS/CSS they reference and puts them in those same caches, so the first
 * open in a basement works too. The catalog itself comes from the offline
 * snapshots, not from this HTML. sw.ts routes are unchanged.
 */

export const COMPOSER_OFFLINE_ROUTES = ['/tickets/create', '/presupuestos/create'] as const;

/** Cache names from src/app/sw.ts. */
const PAGE_CACHE = 'pages';
const OTHERS_CACHE = 'others';
const SCRIPT_CACHE = 'next-static-js-assets';
const STYLE_CACHE = 'static-style-assets';

const WARM_STORAGE_KEY = 'zigzag:composer-offline-warm:v1';
/** Refresh at most this often: new deploys change the chunk names. */
export const COMPOSER_WARM_INTERVAL_MS = 6 * 60 * 60 * 1000;

const STATIC_ASSET_PATTERN = /\/_next\/static\/[^"'\s)<>\\]+?\.(?:js|css)(?=["'\s)<>\\?])/g;

/** Every `/_next/static` script and stylesheet a page references, once each. */
export const extractStaticAssetPaths = (html: string): string[] =>
  Array.from(new Set(html.match(STATIC_ASSET_PATTERN) ?? []));

/**
 * The SW looks pages up by URL. Next varies its HTML on router headers a plain
 * navigation never sends, so the stored copy drops Vary to always match.
 */
const withoutVary = async (response: Response): Promise<Response> => {
  const headers = new Headers(response.headers);
  headers.delete('vary');
  return new Response(await response.text(), {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};

type WarmEnv = {
  fetchImpl?: typeof fetch;
  cacheStorage?: CacheStorage;
  now?: number;
  storage?: Pick<Storage, 'getItem' | 'setItem'>;
  /** Defaults to whether a service worker controls this page. */
  controlled?: boolean;
  force?: boolean;
};

const readLastWarm = (storage: WarmEnv['storage']): number => {
  try {
    return Number(storage?.getItem(WARM_STORAGE_KEY) ?? 0) || 0;
  } catch {
    return 0;
  }
};

/**
 * Fetch the composer pages and their assets into the SW caches. Returns the
 * routes it stored. Skips quietly without a service worker, without signal, on
 * a redirect (expired session, no permission) or when it ran recently.
 */
export const warmComposerPages = async (env: WarmEnv = {}): Promise<string[]> => {
  const cacheStorage =
    env.cacheStorage ?? (typeof caches !== 'undefined' ? caches : undefined);
  const fetchImpl = env.fetchImpl ?? (typeof fetch !== 'undefined' ? fetch : undefined);
  const storage =
    env.storage ?? (typeof window !== 'undefined' ? window.localStorage : undefined);
  const controlled =
    env.controlled ??
    (typeof navigator !== 'undefined' && Boolean(navigator.serviceWorker?.controller));
  const now = env.now ?? Date.now();
  if (!cacheStorage || !fetchImpl || !controlled) return [];
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return [];
  if (!env.force && now - readLastWarm(storage) < COMPOSER_WARM_INTERVAL_MS) return [];

  const [pages, scripts, styles] = await Promise.all([
    cacheStorage.open(PAGE_CACHE),
    cacheStorage.open(SCRIPT_CACHE),
    cacheStorage.open(STYLE_CACHE),
  ]);
  const stored: string[] = [];
  const assets = new Set<string>();

  for (const route of COMPOSER_OFFLINE_ROUTES) {
    try {
      const response = await fetchImpl(route, { credentials: 'same-origin' });
      const contentType = response.headers.get('content-type') ?? '';
      if (!response.ok || response.redirected || !contentType.includes('text/html')) continue;
      const html = await response.clone().text();
      extractStaticAssetPaths(html).forEach((path) => assets.add(path));
      await pages.put(route, await withoutVary(response));
      stored.push(route);
    } catch {
      // No signal halfway: whatever is stored stays, the next run completes it.
    }
  }

  await Promise.all(
    Array.from(assets).map(async (path) => {
      const cache = path.endsWith('.css') ? styles : scripts;
      if (await cache.match(path)) return;
      try {
        const response = await fetchImpl(path, { credentials: 'same-origin' });
        if (response.ok) await cache.put(path, response);
      } catch {
        // Same as above.
      }
    }),
  );

  if (stored.length > 0) {
    try {
      storage?.setItem(WARM_STORAGE_KEY, String(now));
    } catch {
      // Blocked storage: it just warms again next time.
    }
  }
  return stored;
};

/** Logout: cached pages carry the last user's screens, so they go too. */
export const clearComposerPageCaches = async (
  cacheStorage: CacheStorage | undefined = typeof caches !== 'undefined' ? caches : undefined,
): Promise<void> => {
  try {
    window.localStorage.removeItem(WARM_STORAGE_KEY);
  } catch {
    // Ignore blocked storage.
  }
  if (!cacheStorage) return;
  await Promise.all([cacheStorage.delete(PAGE_CACHE), cacheStorage.delete(OTHERS_CACHE)]);
};
