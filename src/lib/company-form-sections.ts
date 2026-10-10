/** Collapsible sections of the self-service company form on mobile (ZIG-I3-2). */
export type CompanyFormSectionKey = 'general' | 'direccion' | 'configuracion';

export type CompanyFormSectionState = Record<CompanyFormSectionKey, boolean>;

export const DEFAULT_COMPANY_FORM_SECTIONS: CompanyFormSectionState = {
  general: true,
  direccion: false,
  configuracion: false,
};

export const COMPANY_FORM_SECTIONS_STORAGE_KEY = 'zigzag.company-form.sections';

/** Field order matches the form, so the first error found is the first one on screen. */
export const COMPANY_FORM_FIELD_SECTIONS: Array<[string, CompanyFormSectionKey]> = [
  ['name', 'general'],
  ['status', 'general'],
  ['email', 'general'],
  ['phone', 'general'],
  ['street', 'direccion'],
  ['interior_number', 'direccion'],
  ['exterior_number', 'direccion'],
  ['neighborhood', 'direccion'],
  ['city', 'direccion'],
  ['state', 'direccion'],
  ['country', 'direccion'],
  ['postal_code', 'direccion'],
  ['settings.tagline', 'configuracion'],
  ['settings.rfc', 'configuracion'],
  ['settings.default_currency', 'configuracion'],
  ['settings.experience_mode', 'configuracion'],
];

type ErrorTree = { [key: string]: unknown };

const hasErrorAt = (errors: ErrorTree, path: string): boolean => {
  let node: unknown = errors;
  for (const part of path.split('.')) {
    if (!node || typeof node !== 'object' || !(part in node)) {
      return false;
    }
    node = (node as ErrorTree)[part];
  }
  return Boolean(node);
};

/** First invalid field in form order, with the section that holds it. */
export const firstInvalidCompanyField = (
  errors: ErrorTree,
): { field: string; section: CompanyFormSectionKey } | null => {
  const match = COMPANY_FORM_FIELD_SECTIONS.find(([field]) => hasErrorAt(errors, field));
  return match ? { field: match[0], section: match[1] } : null;
};

const joinFilled = (parts: Array<string | null | undefined>, separator: string) =>
  parts.map((part) => part?.trim()).filter(Boolean).join(separator);

export const summarizeCompanyGeneral = (values: {
  name?: string;
  email?: string;
  phone?: string;
}) => joinFilled([values.name, values.email, values.phone], ' · ') || 'Sin datos';

export const summarizeCompanyAddress = (values: {
  street?: string;
  exterior_number?: string;
  neighborhood?: string;
  city?: string;
  postal_code?: string;
}) => {
  const street = joinFilled([values.street, values.exterior_number], ' ');
  const cp = values.postal_code?.trim() ? `CP ${values.postal_code.trim()}` : '';
  return joinFilled([street, values.neighborhood, values.city, cp], ', ') || 'Sin dirección';
};

const EXPERIENCE_LABELS: Record<string, string> = {
  auto: 'Inicio automático',
  campo: 'Inicio Campo',
  office: 'Inicio Oficina',
};

export const summarizeCompanySettings = (settings?: {
  rfc?: string;
  default_currency?: string;
  experience_mode?: string;
}) =>
  joinFilled(
    [
      settings?.rfc?.trim() ? `RFC ${settings.rfc.trim()}` : 'Sin RFC',
      settings?.default_currency || 'MXN',
      EXPERIENCE_LABELS[settings?.experience_mode ?? 'auto'] ?? null,
    ],
    ' · ',
  );

export const readCompanyFormSections = (): CompanyFormSectionState => {
  try {
    const raw = window.localStorage.getItem(COMPANY_FORM_SECTIONS_STORAGE_KEY);
    if (!raw) {
      return DEFAULT_COMPANY_FORM_SECTIONS;
    }
    const parsed = JSON.parse(raw) as Partial<CompanyFormSectionState>;
    return {
      general: parsed.general ?? DEFAULT_COMPANY_FORM_SECTIONS.general,
      direccion: parsed.direccion ?? DEFAULT_COMPANY_FORM_SECTIONS.direccion,
      configuracion: parsed.configuracion ?? DEFAULT_COMPANY_FORM_SECTIONS.configuracion,
    };
  } catch {
    return DEFAULT_COMPANY_FORM_SECTIONS;
  }
};

export const writeCompanyFormSections = (state: CompanyFormSectionState) => {
  try {
    window.localStorage.setItem(COMPANY_FORM_SECTIONS_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Per-viewer convenience only; ignore blocked storage.
  }
};
