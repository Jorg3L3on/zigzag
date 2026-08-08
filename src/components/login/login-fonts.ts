import { Figtree, IBM_Plex_Mono, Syne } from 'next/font/google';

/** Display face aligned with marketing Syne. */
export const loginDisplay = Syne({
  subsets: ['latin'],
  variable: '--font-login-display',
  weight: ['600', '700', '800'],
  display: 'swap',
});

/** Body face aligned with marketing Figtree. */
export const loginSans = Figtree({
  subsets: ['latin'],
  variable: '--font-login-sans',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

/** Mono face for folio, micro-labels, and stamp mark. */
export const loginMono = IBM_Plex_Mono({
  subsets: ['latin'],
  variable: '--font-login-mono',
  weight: ['400', '500', '600'],
  display: 'swap',
});
