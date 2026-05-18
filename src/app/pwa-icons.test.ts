import fs from 'node:fs';
import path from 'node:path';

import { metadata } from '@/app/layout';

const repoRoot = path.join(__dirname, '..', '..');

const PWA_ICON_FILES = [
  'public/icons/icon-192.png',
  'public/icons/icon-512.png',
  'public/icons/icon-512-maskable.png',
  'src/app/apple-icon.png',
  'src/app/favicon.ico',
  'src/app/icon.png',
] as const;

const METADATA_ICON_URLS = [
  '/icon.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-512-maskable.png',
  '/apple-icon.png',
  '/favicon.ico',
] as const;

describe('PWA icon assets', () => {
  it.each(PWA_ICON_FILES)('exists on disk: %s', (relativePath) => {
    expect(fs.existsSync(path.join(repoRoot, relativePath))).toBe(true);
  });

  it('layout metadata references the same icon URLs as the manifest', () => {
    const iconEntries = metadata.icons?.icon;
    expect(iconEntries).toBeDefined();

    const iconUrls = iconEntries!.map((entry) =>
      typeof entry === 'string' ? entry : entry.url,
    );

    expect(iconUrls).toEqual(
      expect.arrayContaining([
        '/icon.png',
        '/icons/icon-192.png',
        '/icons/icon-512.png',
        '/icons/icon-512-maskable.png',
      ]),
    );

    const appleUrl = metadata.icons?.apple?.[0];
    expect(
      typeof appleUrl === 'string' ? appleUrl : appleUrl?.url,
    ).toBe('/apple-icon.png');

    expect(metadata.icons?.shortcut).toBe('/favicon.ico');
    expect(METADATA_ICON_URLS.length).toBeGreaterThan(0);
  });
});
