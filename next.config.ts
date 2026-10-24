import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import { withSerwist } from '@serwist/turbopack';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const isDev = process.env.NODE_ENV !== 'production';

// Next.js, Turbopack, and React dev tooling rely on eval() and websocket HMR in
// development. These relaxations are scoped to dev only; production stays strict.
const scriptSrc = isDev
  ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
  : "script-src 'self' 'unsafe-inline'";
const connectSrc = isDev
  ? "connect-src 'self' ws: wss:"
  : "connect-src 'self'";

const nextConfig: NextConfig = {
  // Playwright and local tools often hit 127.0.0.1 while the dev server uses localhost.
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.public.blob.vercel-storage.com',
      },
      {
        protocol: 'https',
        hostname: '**.blob.vercel-storage.com',
      },
    ],
  },
  // `/guides` serves public/guides/index.html without a directory URL base, so
  // relative assets (guides.css, assets/logo.png) resolve to the site root and 404.
  async redirects() {
    return [
      {
        source: '/guides',
        destination: '/guides/index.html',
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // HSTS only in production. Sending it over plain-HTTP localhost pins
          // the browser to HTTPS and breaks local access (e.g. in Opera).
          ...(isDev
            ? []
            : [
                {
                  key: 'Strict-Transport-Security',
                  value: 'max-age=63072000; includeSubDomains; preload',
                },
              ]),
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value:
              'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "base-uri 'self'",
              "frame-ancestors 'none'",
              "form-action 'self'",
              "object-src 'none'",
              scriptSrc,
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data:",
              connectSrc,
            ].join('; '),
          },
        ],
      },
      {
        // The in-app PDF viewers embed the recibo / presupuesto in a same-origin
        // iframe (ZIG-I24). Later rules win for the same key: only this route
        // may be framed, and only by our own pages.
        source: '/api/tickets/:id/invoice',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Content-Security-Policy', value: "frame-ancestors 'self'" },
        ],
      },
    ];
  },
};

export default withSerwist(withNextIntl(nextConfig));

