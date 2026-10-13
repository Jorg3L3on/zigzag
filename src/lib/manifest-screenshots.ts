import type { MetadataRoute } from 'next';

/**
 * Install screenshots (ZIG-I21-4): Chrome on Android shows the `narrow` ones
 * in a richer install sheet; desktop Chrome uses `wide`. Captured from the
 * demo tenant by `scripts/capture-manifest-screenshots.mjs`.
 */
export const MANIFEST_SCREENSHOTS = [
  {
    src: '/screenshots/narrow-dashboard.webp',
    sizes: '824x1830',
    type: 'image/webp',
    form_factor: 'narrow',
    label: 'Hoy: atrasados, por cobrar y recordatorios',
  },
  {
    src: '/screenshots/narrow-tickets.webp',
    sizes: '824x1830',
    type: 'image/webp',
    form_factor: 'narrow',
    label: 'Tickets de servicio con su saldo',
  },
  {
    src: '/screenshots/narrow-recordatorios.webp',
    sizes: '824x1830',
    type: 'image/webp',
    form_factor: 'narrow',
    label: 'Recordatorios de servicio de tus clientes',
  },
  {
    src: '/screenshots/wide-dashboard.webp',
    sizes: '1440x900',
    type: 'image/webp',
    form_factor: 'wide',
    label: 'Panel de ZigZag en escritorio',
  },
] satisfies NonNullable<MetadataRoute.Manifest['screenshots']>;
