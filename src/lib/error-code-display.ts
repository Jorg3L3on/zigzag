/**
 * Error codes ("Código: AU001") are for support, not for the sentence the user
 * reads (ZIG-I18-3). Strings still carry the code so logs and tests keep it;
 * the UI splits it onto a second, smaller line.
 */
const TRAILING_CODE = /\s*Código:\s*([A-Z]{2,3}\d{3})\.?\s*$/;

export type SplitErrorCode = { message: string; code: string | null };

export const splitErrorCode = (text: string): SplitErrorCode => {
  const match = TRAILING_CODE.exec(text);
  if (!match) return { message: text, code: null };
  return { message: text.slice(0, match.index).trimEnd(), code: match[1] };
};
