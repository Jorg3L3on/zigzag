import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const brandDir = path.join(root, 'assets/brand');

const brand = (file) => path.join(brandDir, file);

/** Exported PNGs copied as-is: they already have the right canvas and background. */
const COPIES = [
  { file: 'src/app/icon.png', from: 'zigzag-favicon-32.png' },
  { file: 'src/app/icon.svg', from: 'zigzag-mark.svg' },
  { file: 'src/app/apple-icon.png', from: 'zigzag-apple-touch-180.png' },
  { file: 'public/apple-touch-icon.png', from: 'zigzag-apple-touch-180.png' },
  { file: 'public/icons/icon-192.png', from: 'zigzag-icon-192.png' },
  { file: 'public/icons/icon-512.png', from: 'zigzag-icon-512.png' },
  // The receipt sits inside the 80% maskable safe circle, so the full-bleed icon works as-is.
  { file: 'public/icons/icon-512-maskable.png', from: 'zigzag-icon-512.png' },
  { file: 'public/brand/zigzag-mark.svg', from: 'zigzag-mark.svg' },
  {
    file: 'public/brand/zigzag-icon-rounded.svg',
    from: 'zigzag-icon-rounded.svg',
  },
  {
    file: 'public/brand/zigzag-icon-square.svg',
    from: 'zigzag-icon-square.svg',
  },
];

const FAVICON_SIZES = [16, 32, 64];
const LOGO_SIZE = 512;

/** ICO container with PNG-compressed entries (supported by every current browser). */
const buildIco = (images) => {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);

  let offset = header.length + images.length * 16;
  const entries = images.map(({ size, data }) => {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += data.length;
    return entry;
  });

  return Buffer.concat([header, ...entries, ...images.map(({ data }) => data)]);
};

const write = (relativePath, buffer) => {
  const destination = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, buffer);
  console.log(`wrote ${relativePath}`);
};

const main = async () => {
  for (const { file, from } of COPIES) {
    write(file, fs.readFileSync(brand(from)));
  }

  const favicons = FAVICON_SIZES.map((size) => ({
    size,
    data: fs.readFileSync(brand(`zigzag-favicon-${size}.png`)),
  }));
  write('src/app/favicon.ico', buildIco(favicons));

  // Square logo for the README, guides and anything that needs a raster brand image.
  const logo = await sharp(brand('zigzag-icon-rounded.svg'), {
    density: 72 * (LOGO_SIZE / 100),
  })
    .resize(LOGO_SIZE, LOGO_SIZE)
    .png({ compressionLevel: 9 })
    .toBuffer();
  write('public/logo.png', logo);
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
