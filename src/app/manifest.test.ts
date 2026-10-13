import fs from 'node:fs';
import path from 'node:path';

import sharp from 'sharp';

import manifest from '@/app/manifest';
import { MANIFEST_SCREENSHOTS } from '@/lib/manifest-screenshots';

describe('web app manifest', () => {
  it('opens on dashboard with flexible orientation', () => {
    const result = manifest();

    expect(result.start_url).toBe('/dashboard');
    expect(result.orientation).toBe('any');
    expect(result.display).toBe('standalone');
    expect(result.theme_color).toBe('#ffffff');
    expect(result.scope).toBe('/');
  });
});

describe('install screenshots (ZIG-I21-4)', () => {
  const repoRoot = path.join(__dirname, '..', '..');

  it('keeps the install identity equal to the start URL (existing installs stay the same app)', () => {
    expect(manifest().id).toBe(manifest().start_url);
  });

  it('ships narrow screenshots for the Android install sheet and a wide one for desktop', () => {
    const { screenshots } = manifest();
    expect(screenshots?.filter((shot) => shot.form_factor === 'narrow').length).toBeGreaterThanOrEqual(1);
    expect(screenshots?.some((shot) => shot.form_factor === 'wide')).toBe(true);
  });

  it.each(MANIFEST_SCREENSHOTS.map((shot) => [shot.src, shot] as const))(
    '%s exists with the declared size and a ratio Chrome accepts',
    async (src, shot) => {
      const file = path.join(repoRoot, 'public', src);
      expect(fs.existsSync(file)).toBe(true);
      const { width, height } = await sharp(file).metadata();
      expect(`${width}x${height}`).toBe(shot.sizes);
      // Chrome ignores screenshots whose long side exceeds 2.3× the short side.
      const [long, short] = [Math.max(width!, height!), Math.min(width!, height!)];
      expect(long / short).toBeLessThanOrEqual(2.3);
      expect(shot.form_factor === 'narrow' ? height! > width! : width! > height!).toBe(true);
    },
  );
});
