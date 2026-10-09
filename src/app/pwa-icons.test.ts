import fs from 'node:fs';
import path from 'node:path';

import { metadata } from '@/app/layout';

const repoRoot = path.join(__dirname, '..', '..');

const PWA_ICON_FILES = [
  'public/logo.png',
  'public/brand/zigzag-mark.svg',
  'public/brand/zigzag-icon-rounded.svg',
  'public/brand/zigzag-icon-square.svg',
  'public/icons/icon-192.png',
  'public/icons/icon-512.png',
  'public/icons/icon-512-maskable.png',
  'public/apple-touch-icon.png',
  'src/app/apple-icon.png',
  'src/app/favicon.ico',
  'src/app/icon.png',
  'src/app/icon.svg',
] as const;

const METADATA_ICON_URLS = [
  '/icon.svg',
  '/icon.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-512-maskable.png',
  '/apple-icon.png',
  '/favicon.ico',
] as const;

const PNG_ICON_SIZES = {
  'public/logo.png': 512,
  'public/icons/icon-192.png': 192,
  'public/icons/icon-512.png': 512,
  'public/icons/icon-512-maskable.png': 512,
  'public/apple-touch-icon.png': 180,
  'src/app/apple-icon.png': 180,
  'src/app/icon.png': 32,
} as const;

const BRAND_DIR = 'assets/brand';

const listPngChunkTypes = (relativePath: string) => {
  const buffer = fs.readFileSync(path.join(repoRoot, relativePath));
  const types: string[] = [];
  let offset = 8;

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    types.push(buffer.toString('ascii', offset + 4, offset + 8));
    offset += 12 + length;
  }

  return types;
};

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
        '/icon.svg',
        '/icon.png',
        '/icons/icon-192.png',
        '/icons/icon-512.png',
        '/icons/icon-512-maskable.png',
      ]),
    );

    const appleUrl = metadata.icons?.apple?.[0];
    expect(typeof appleUrl === 'string' ? appleUrl : appleUrl?.url).toBe(
      '/apple-icon.png',
    );

    expect(metadata.icons?.shortcut).toBe('/favicon.ico');
    expect(METADATA_ICON_URLS.length).toBeGreaterThan(0);
  });

  it('favicon.ico packs the 16, 32 and 64 px brand favicons', () => {
    const buffer = fs.readFileSync(path.join(repoRoot, 'src/app/favicon.ico'));

    expect(buffer.readUInt16LE(2)).toBe(1);
    expect(buffer.readUInt16LE(4)).toBe(3);
    expect([0, 1, 2].map((i) => buffer.readUInt8(6 + i * 16))).toEqual([
      16, 32, 64,
    ]);
  });

  it('brand sources carry no C2PA provenance metadata', () => {
    const brandFiles = fs.readdirSync(path.join(repoRoot, BRAND_DIR));

    expect(brandFiles).toHaveLength(13);

    for (const file of brandFiles) {
      const relativePath = path.join(BRAND_DIR, file);

      if (file.endsWith('.svg')) {
        expect(
          fs.readFileSync(path.join(repoRoot, relativePath), 'utf8'),
        ).not.toMatch(/c2pa/i);
      } else {
        expect(listPngChunkTypes(relativePath)).not.toContain('caBX');
      }
    }
  });

  it('served brand SVGs match the sources', () => {
    for (const file of [
      'zigzag-mark.svg',
      'zigzag-icon-rounded.svg',
      'zigzag-icon-square.svg',
    ]) {
      expect(
        fs.readFileSync(path.join(repoRoot, 'public/brand', file), 'utf8'),
      ).toBe(fs.readFileSync(path.join(repoRoot, BRAND_DIR, file), 'utf8'));
    }
  });
});
