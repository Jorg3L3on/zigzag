import { spawnSync } from 'node:child_process';
import { createSerwistRoute } from '@serwist/turbopack';

import { additionalPrecacheEntries } from '@/lib/pwa-precache-entries';

const revision =
  spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf-8' }).stdout?.trim() ||
  crypto.randomUUID();

// Files under public/ (the PWA icons, badge-96.png…) are precached by the
// plugin itself; listing them here again breaks the worker (ZIG-15).
export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } =
  createSerwistRoute({
    swSrc: 'src/app/sw.ts',
    useNativeEsbuild: true,
    additionalPrecacheEntries: additionalPrecacheEntries(revision),
  });
