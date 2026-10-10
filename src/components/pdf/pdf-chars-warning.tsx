import { findUnsupportedPdfChars } from '@/lib/pdf-text-support';

type PdfCharsWarningProps = {
  /** The text the user typed; the warning shows only when the PDF cannot print some of it. */
  text: string | null | undefined;
  id?: string;
};

/**
 * Typed names and notes go to the PDF, whose fonts lack emoji, CJK, Arabic and
 * Devanagari (ZIG-I12 Q3). They are stripped there, so say so while typing.
 */
export const PdfCharsWarning = ({ text, id }: PdfCharsWarningProps) => {
  const unsupported = findUnsupportedPdfChars(text);
  if (unsupported.length === 0) return null;
  const shown = unsupported.slice(0, 6).join(' ');
  return (
    <p
      id={id}
      role="status"
      data-testid="pdf-chars-warning"
      className="text-xs text-amber-700 [overflow-wrap:anywhere] dark:text-amber-300"
    >
      Estos caracteres no salen en el PDF: {shown}
      {unsupported.length > 6 ? ' …' : ''}
    </p>
  );
};
