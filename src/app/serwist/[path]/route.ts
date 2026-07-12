import { spawnSync } from 'node:child_process';
import { createSerwistRoute } from '@serwist/turbopack';

const revision =
  spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf-8' }).stdout?.trim() ||
  crypto.randomUUID();

export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } =
  createSerwistRoute({
    swSrc: 'src/app/sw.ts',
    useNativeEsbuild: true,
    additionalPrecacheEntries: [
      { url: '/offline', revision },
      { url: '/icons/icon-192.png', revision },
      { url: '/icons/icon-512.png', revision },
      { url: '/favicon.ico', revision },
      { url: '/manifest.webmanifest', revision },
    ],
  });
