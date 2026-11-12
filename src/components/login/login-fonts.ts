import { Bricolage_Grotesque, Geist, IBM_Plex_Mono } from 'next/font/google';

/** Display face aligned with the marketing "Papel y tinta" display (Bricolage Grotesque). */
export const loginDisplay = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-login-display',
  weight: ['600', '700', '800'],
  display: 'swap',
});

/** Body face aligned with the marketing text face (Geist). */
export const loginSans = Geist({
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
