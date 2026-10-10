/**
 * IBM Plex for the receipt PDF, embedded so output never depends on the network.
 * Server-only: the base64 modules are ~1.2 MB; import only from API routes.
 * Regenerate the modules with `npm run pdf-fonts:generate`.
 *
 * Each weight is its own jsPDF family (style `normal`) so every embedded font
 * gets a distinct /BaseFont name in the PDF.
 */
import type { jsPDF } from 'jspdf';
import { PLEX_MONO_400 } from './plex-mono-400';
import { PLEX_MONO_500 } from './plex-mono-500';
import { PLEX_SANS_400 } from './plex-sans-400';
import { PLEX_SANS_500 } from './plex-sans-500';
import { PLEX_SANS_600 } from './plex-sans-600';

export const RECEIPT_FONTS = {
  sans400: 'PlexSans-Regular',
  sans500: 'PlexSans-Medium',
  sans600: 'PlexSans-SemiBold',
  mono400: 'PlexMono-Regular',
  mono500: 'PlexMono-Medium',
} as const;

export type ReceiptFont = (typeof RECEIPT_FONTS)[keyof typeof RECEIPT_FONTS];

const FONT_FILES: ReadonlyArray<{ file: string; data: string; family: ReceiptFont }> = [
  { file: 'IBMPlexSans-Regular.ttf', data: PLEX_SANS_400, family: RECEIPT_FONTS.sans400 },
  { file: 'IBMPlexSans-Medium.ttf', data: PLEX_SANS_500, family: RECEIPT_FONTS.sans500 },
  { file: 'IBMPlexSans-SemiBold.ttf', data: PLEX_SANS_600, family: RECEIPT_FONTS.sans600 },
  { file: 'IBMPlexMono-Regular.ttf', data: PLEX_MONO_400, family: RECEIPT_FONTS.mono400 },
  { file: 'IBMPlexMono-Medium.ttf', data: PLEX_MONO_500, family: RECEIPT_FONTS.mono500 },
];

export const registerReceiptFonts = (doc: jsPDF): void => {
  for (const font of FONT_FILES) {
    doc.addFileToVFS(font.file, font.data);
    doc.addFont(font.file, font.family, 'normal');
  }
};
