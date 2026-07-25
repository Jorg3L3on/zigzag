import { Figtree, Syne } from 'next/font/google';

/** Display face for ZigZag marketing brand marks and section titles. */
export const marketingDisplay = Syne({
  subsets: ['latin'],
  variable: '--font-marketing-display',
  weight: ['600', '700', '800'],
  display: 'swap',
});

/** Body face for marketing copy — distinct from the app Geist stack. */
export const marketingSans = Figtree({
  subsets: ['latin'],
  variable: '--font-marketing-sans',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});
