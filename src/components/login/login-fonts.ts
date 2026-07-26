import { IBM_Plex_Mono, Inter, Space_Grotesk } from 'next/font/google';

/** Display face for login ticket headlines and stamp CTA (HTML prototype). */
export const loginDisplay = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-login-display',
  weight: ['500', '600', '700'],
  display: 'swap',
});

/** Body face for login fields and copy (HTML prototype uses Inter). */
export const loginSans = Inter({
  subsets: ['latin'],
  variable: '--font-login-sans',
  weight: ['400', '500', '600'],
  display: 'swap',
});

/** Mono face for folio, micro-labels, and stamp mark. */
export const loginMono = IBM_Plex_Mono({
  subsets: ['latin'],
  variable: '--font-login-mono',
  weight: ['400', '500', '600'],
  display: 'swap',
});
