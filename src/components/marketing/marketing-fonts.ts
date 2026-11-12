import { Bricolage_Grotesque, Geist, IBM_Plex_Mono } from 'next/font/google';

/** "Papel y tinta" display face: logo wordmark, headlines and section titles. */
export const marketingDisplay = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-marketing-display',
  weight: ['400', '600', '700', '800'],
  display: 'swap',
});

/** Text face for marketing copy. */
export const marketingSans = Geist({
  subsets: ['latin'],
  variable: '--font-marketing-sans',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

/** Labels, folios and amounts (the receipt voice). */
export const marketingMono = IBM_Plex_Mono({
  subsets: ['latin'],
  variable: '--font-marketing-mono',
  weight: ['400', '500', '600'],
  display: 'swap',
});

/** All three font variables, for the element that hosts a marketing surface. */
export const marketingFontVariables = `${marketingDisplay.variable} ${marketingSans.variable} ${marketingMono.variable}`;
