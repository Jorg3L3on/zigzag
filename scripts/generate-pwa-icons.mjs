import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const sourcePng = path.join(root, 'assets/icon.png');
const sourceIco = path.join(root, 'assets/favicon.ico');

const OUTPUTS = [
  { file: 'src/app/icon.png', size: 32 },
  { file: 'src/app/apple-icon.png', size: 180 },
  { file: 'public/apple-touch-icon.png', size: 180 },
  { file: 'public/icons/icon-192.png', size: 192 },
  { file: 'public/icons/icon-512.png', size: 512 },
  { file: 'public/icons/icon-512-maskable.png', size: 512, maskable: true },
];

const renderIcon = async (size, { maskable = false } = {}) => {
  const contentSize = Math.round(size * (maskable ? 0.68 : 0.84));

  const mark = await sharp(sourcePng)
    .resize({
      width: contentSize,
      height: contentSize,
      fit: 'inside',
      withoutEnlargement: false,
    })
    .png()
    .toBuffer();

  const markMetadata = await sharp(mark).metadata();

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 1 },
    },
  })
    .composite([
      {
        input: mark,
        left: Math.round((size - markMetadata.width) / 2),
        top: Math.round((size - markMetadata.height) / 2),
      },
    ])
    .png()
    .toBuffer();
};

const main = async () => {
  fs.copyFileSync(sourcePng, path.join(root, 'public/logo.png'));
  console.log('wrote public/logo.png');

  for (const output of OUTPUTS) {
    const buffer = await renderIcon(output.size, output);
    const destination = path.join(root, output.file);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, buffer);
    console.log(`wrote ${output.file}`);
  }

  fs.copyFileSync(sourceIco, path.join(root, 'src/app/favicon.ico'));
  console.log('wrote src/app/favicon.ico');
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
