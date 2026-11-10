/**
 * The system user's chosen company, mirrored into a cookie so the root layout
 * can seed `CompanyProvider` on the server and the first client render matches
 * (ZIG-I37-5). It is a UI preference only: no server action or route reads it
 * to authorize anything; every action still validates the tenant on its own.
 *
 * Lives outside the "use client" provider so `src/app/layout.tsx` can parse it.
 */
export const SELECTED_COMPANY_COOKIE_NAME = 'zigzag_selected_company';

/** The legacy (pre-cookie) localStorage key, still written for older tabs. */
export const SELECTED_COMPANY_STORAGE_KEY = 'selectedCompany';

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/** Browsers cap a cookie near 4 KB; stay well under it. */
const MAX_COOKIE_VALUE_LENGTH = 3000;

export type StoredSelectedCompany = {
  id: number;
  name: string;
  logoUrl: string | null;
  plan: string;
  is_system: boolean;
};

/**
 * Validates an unknown JSON value as a stored company. Anything malformed,
 * or an id that is not a positive integer, is ignored (null).
 */
export const parseStoredSelectedCompany = (
  value: unknown,
): StoredSelectedCompany | null => {
  if (value == null || typeof value !== 'object') {
    return null;
  }
  const raw = value as Record<string, unknown>;
  const id = raw.id;
  if (typeof id !== 'number' || !Number.isInteger(id) || id <= 0) {
    return null;
  }
  if (typeof raw.name !== 'string' || raw.name.trim() === '') {
    return null;
  }
  return {
    id,
    name: raw.name,
    logoUrl: typeof raw.logoUrl === 'string' ? raw.logoUrl : null,
    plan: typeof raw.plan === 'string' ? raw.plan : 'Enterprise',
    is_system: raw.is_system === true,
  };
};

/** Parses a JSON string (cookie value or localStorage item); null when invalid. */
export const parseSelectedCompanyJson = (
  json: string | null | undefined,
): StoredSelectedCompany | null => {
  if (!json) {
    return null;
  }
  try {
    return parseStoredSelectedCompany(JSON.parse(json));
  } catch {
    return null;
  }
};

/** Parses the raw (URI-encoded) cookie value; null when absent or corrupt. */
export const parseSelectedCompanyCookie = (
  value: string | null | undefined,
): StoredSelectedCompany | null => {
  if (!value) {
    return null;
  }
  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return null;
  }
  return parseSelectedCompanyJson(decoded);
};

/** The URI-encoded cookie value; drops the logo when the value would be too long. */
export const serializeSelectedCompanyCookie = (
  company: StoredSelectedCompany,
): string => {
  const encoded = encodeURIComponent(JSON.stringify(company));
  if (encoded.length <= MAX_COOKIE_VALUE_LENGTH) {
    return encoded;
  }
  return encodeURIComponent(JSON.stringify({ ...company, logoUrl: null }));
};

const secureAttribute = (): string =>
  typeof window !== 'undefined' && window.location.protocol === 'https:'
    ? '; Secure'
    : '';

/** Writes (company) or clears (null) the cookie from the browser. */
export const writeSelectedCompanyCookie = (
  company: StoredSelectedCompany | null,
): void => {
  if (typeof document === 'undefined') {
    return;
  }
  if (company) {
    document.cookie = `${SELECTED_COMPANY_COOKIE_NAME}=${serializeSelectedCompanyCookie(company)}; path=/; max-age=${ONE_YEAR_SECONDS}; SameSite=Lax${secureAttribute()}`;
  } else {
    document.cookie = `${SELECTED_COMPANY_COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax${secureAttribute()}`;
  }
};
