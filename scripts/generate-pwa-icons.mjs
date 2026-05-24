import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';
import toIco from 'to-ico';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const sourceSvg = path.join(root, 'assets/icon-z.svg');

const OUTPUTS = [
  { file: 'src/app/icon.png', size: 32 },
  { file: 'src/app/apple-icon.png', size: 180 },
  { file: 'public/apple-touch-icon.png', size: 180 },
  { file: 'public/icons/icon-192.png', size: 192 },
  { file: 'public/icons/icon-512.png', size: 512 },
  { file: 'public/icons/icon-512-maskable.png', size: 512, maskable: true },
];

const ICO_SIZES = [16, 24, 32, 48];

const renderIcon = async (size, maskable = false) => {
  const contentSize = maskable ? Math.round(size * 0.72) : size;

  const letter = await sharp(sourceSvg)
    .resize(contentSize, contentSize)
    .png()
    .toBuffer();

  if (!maskable) {
    return letter;
  }

  const pad = Math.round((size - contentSize) / 2);
  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 1 },
    },
  })
    .composite([{ input: letter, left: pad, top: pad }])
    .png()
    .toBuffer();
};

const main = async () => {
  for (const output of OUTPUTS) {
    const buffer = await renderIcon(output.size, output.maskable);
    const destination = path.join(root, output.file);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, buffer);
    console.log(`wrote ${output.file}`);
  }

  const pngBuffers = await Promise.all(ICO_SIZES.map((size) => renderIcon(size)));
  const ico = await toIco(pngBuffers);
  fs.writeFileSync(path.join(root, 'src/app/favicon.ico'), ico);
  console.log('wrote src/app/favicon.ico');
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
