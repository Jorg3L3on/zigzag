/** Collapsible sections of the self-service company form on mobile (ZIG-I3-2). */
export type CompanyFormSectionKey = 'general' | 'direccion' | 'configuracion' | 'pago';

export type CompanyFormSectionState = Record<CompanyFormSectionKey, boolean>;

export const DEFAULT_COMPANY_FORM_SECTIONS: CompanyFormSectionState = {
  general: true,
  direccion: false,
  configuracion: false,
  pago: false,
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
  ['settings.payment_bank', 'pago'],
  ['settings.payment_holder', 'pago'],
  ['settings.payment_kind', 'pago'],
  ['settings.payment_clabe', 'pago'],
  ['settings.payment_card', 'pago'],
  ['settings.payment_account', 'pago'],
  ['settings.payment_note', 'pago'],
];

type ErrorTree = { [key: string]: unknown };

const isSetAt = (errors: ErrorTree, path: string): boolean => {
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
  const match = COMPANY_FORM_FIELD_SECTIONS.find(([field]) => isSetAt(errors, field));
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

/** One line for the closed "Para pagar por transferencia" section (ZIG-I20-1, ZIG-23). */
export const summarizeCompanyPayment = (settings?: {
  payment_kind?: string;
  payment_bank?: string;
  payment_holder?: string;
  payment_clabe?: string;
  payment_card?: string;
  payment_account?: string;
}) => {
  const kind = settings?.payment_kind === 'card' || settings?.payment_kind === 'account'
    ? settings.payment_kind
    : 'clabe';
  const raw =
    kind === 'card'
      ? settings?.payment_card
      : kind === 'account'
        ? settings?.payment_account
        : settings?.payment_clabe;
  const digits = raw?.replace(/[\s-]/g, '') ?? '';
  const label = kind === 'card' ? 'Tarjeta' : kind === 'account' ? 'Cuenta' : 'CLABE';
  return (
    joinFilled(
      [
        settings?.payment_bank,
        settings?.payment_holder,
        digits ? `${label} ···${digits.slice(-4)}` : '',
      ],
      ' · ',
    ) || 'Sin datos para pagar'
  );
};

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
      pago: parsed.pago ?? DEFAULT_COMPANY_FORM_SECTIONS.pago,
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

/** Datos cards on md+ (ZIG-I32-1), in page order; the ids are the side-nav anchors. */
export const COMPANY_DESKTOP_SECTIONS = [
  { id: 'perfil', label: 'Perfil' },
  { id: 'direccion', label: 'Dirección' },
  { id: 'documentos', label: 'Documentos y folios' },
  { id: 'pagos', label: 'Pagos por transferencia' },
  { id: 'inicio', label: 'Inicio' },
] as const;

/** Labels for the "Cambios sin guardar" bar, in form order. */
export const COMPANY_FIELD_LABELS: Array<[string, string]> = [
  ['name', 'Nombre'],
  ['settings.tagline', 'Lema o giro'],
  ['email', 'Correo electrónico'],
  ['phone', 'Teléfono'],
  ['street', 'Calle'],
  ['exterior_number', 'Número exterior'],
  ['interior_number', 'Número interior'],
  ['neighborhood', 'Colonia'],
  ['postal_code', 'Código postal'],
  ['city', 'Ciudad'],
  ['state', 'Estado'],
  ['country', 'País'],
  ['settings.rfc', 'RFC'],
  ['settings.default_currency', 'Moneda'],
  ['settings.folio_prefix_presupuesto', 'Prefijo de presupuestos'],
  ['settings.folio_prefix_ticket', 'Prefijo de recibos'],
  ['settings.payment_bank', 'Banco'],
  ['settings.payment_holder', 'A nombre de'],
  ['settings.payment_kind', 'Método de pago'],
  ['settings.payment_clabe', 'CLABE'],
  ['settings.payment_card', 'Número de tarjeta'],
  ['settings.payment_account', 'Número de cuenta'],
  ['settings.payment_note', 'Indicación para tu cliente'],
  ['settings.experience_mode', 'Inicio'],
];

/** Labels of the fields react-hook-form marks dirty, in form order. */
export const listChangedCompanyFields = (dirtyFields: ErrorTree): string[] =>
  COMPANY_FIELD_LABELS.filter(([field]) => isSetAt(dirtyFields, field)).map(
    ([, label]) => label,
  );
