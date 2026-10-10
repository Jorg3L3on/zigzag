/**
 * Free-text notes can hold long runs of blank lines (an accidental paste, a
 * held Enter). Shows and prints them as at most one blank line in a row
 * (ZIG-I12). Line breaks stay; edges are trimmed.
 */
export const collapseBlankLines = (text: string): string =>
  text
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
