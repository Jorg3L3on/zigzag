import fs from 'node:fs';
import path from 'node:path';

import { metadata } from '@/app/layout';

const repoRoot = path.join(__dirname, '..', '..');

const PWA_ICON_FILES = [
  'public/logo.png',
  'public/icons/icon-192.png',
  'public/icons/icon-512.png',
  'public/icons/icon-512-maskable.png',
  'public/apple-touch-icon.png',
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

const PNG_ICON_SIZES = {
  'public/icons/icon-192.png': 192,
  'public/icons/icon-512.png': 512,
  'public/icons/icon-512-maskable.png': 512,
  'public/apple-touch-icon.png': 180,
  'src/app/apple-icon.png': 180,
  'src/app/icon.png': 32,
} as const;

const readPngDimensions = (relativePath: string) => {
  const buffer = fs.readFileSync(path.join(repoRoot, relativePath));

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
};

describe('PWA icon assets', () => {
  it.each(PWA_ICON_FILES)('exists on disk: %s', (relativePath) => {
    expect(fs.existsSync(path.join(repoRoot, relativePath))).toBe(true);
  });

  it.each(Object.entries(PNG_ICON_SIZES))(
    'uses the expected square canvas: %s',
    (relativePath, size) => {
      expect(readPngDimensions(relativePath)).toEqual({
        width: size,
        height: size,
      });
    },
  );

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
