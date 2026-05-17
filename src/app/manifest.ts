import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ZigZag',
    short_name: 'ZigZag',
    description: 'Gestión de tickets de servicio multi-empresa',
    start_url: '/login',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    lang: 'es',
    dir: 'ltr',
    background_color: '#ffffff',
    theme_color: '#2563eb',
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
