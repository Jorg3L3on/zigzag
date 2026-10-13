import type { MetadataRoute } from 'next';

import { MANIFEST_SCREENSHOTS } from '@/lib/manifest-screenshots';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/dashboard',
    name: 'ZigZag',
    short_name: 'ZigZag',
    description: 'Gestión de tickets de servicio multi-empresa',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    lang: 'es',
    dir: 'ltr',
    background_color: '#ffffff',
    theme_color: '#ffffff',
    categories: ['business', 'productivity'],
    screenshots: MANIFEST_SCREENSHOTS,
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512-maskable.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
