import fs from 'node:fs';
import path from 'node:path';

import {
  ADDITIONAL_PRECACHE_URLS,
  additionalPrecacheEntries,
} from './pwa-precache-entries';

const publicDir = path.join(__dirname, '..', '..', 'public');

describe('additional precache entries (ZIG-15)', () => {
  it('never names a file that @serwist/turbopack already precaches from public/', () => {
    // The plugin globs public/ with a content-hash revision; a second entry for
    // the same URL with the git-SHA revision makes Serwist throw
    // add-to-cache-list-conflicting-entries and the worker never installs.
    const collisions = ADDITIONAL_PRECACHE_URLS.filter((url) =>
      fs.existsSync(path.join(publicDir, url)),
    );
    expect(collisions).toEqual([]);
  });

  it('lists each URL once', () => {
    expect(new Set(ADDITIONAL_PRECACHE_URLS).size).toBe(
      ADDITIONAL_PRECACHE_URLS.length,
    );
  });

  it('stamps every entry with the build revision', () => {
    const entries = additionalPrecacheEntries('abc123');
    expect(entries).toEqual(
      ADDITIONAL_PRECACHE_URLS.map((url) => ({ url, revision: 'abc123' })),
    );
  });

  it('keeps the offline shell, the favicon and the manifest', () => {
    expect(ADDITIONAL_PRECACHE_URLS).toEqual(
      expect.arrayContaining(['/offline', '/favicon.ico', '/manifest.webmanifest']),
    );
  });
});
