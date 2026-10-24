import { z } from 'zod';
import type { CompanySettingsJson } from '@/db/schema';
import { DEFAULT_FOLIO_PREFIX, FOLIO_PREFIX_MAX_LENGTH, normalizeFolioPrefix } from '@/lib/folio';
import {
  ACCOUNT_MAX_LENGTH,
  ACCOUNT_MIN_LENGTH,
  CARD_MAX_LENGTH,
  CARD_MIN_LENGTH,
  CLABE_LENGTH,
  isPaymentKind,
  isValidAccountNumber,
  isValidCardNumber,
  isValidClabe,
  normalizeClabe,
  PAYMENT_BANK_MAX,
  PAYMENT_HOLDER_MAX,
  PAYMENT_NOTE_MAX,
  type PaymentKind,
} from '@/lib/company-payment-info';

/** Settings stored in `Company.settings` (JSON). Replace-on-save from the form. */
export const COMPANY_TAGLINE_MAX = 60;

/** Up to five letters or digits; empty keeps the default (P / R). */
const folioPrefixField = z
  .string()
  .trim()
  .max(FOLIO_PREFIX_MAX_LENGTH, `Máximo ${FOLIO_PREFIX_MAX_LENGTH} caracteres`)
  .regex(/^[A-Za-z0-9]*$/, 'Usa solo letras y números')
  .optional();

export const companySettingsBaseSchema = z.object({
  rfc: z.string().optional(),
  /** Lema o giro printed under the company name on PDFs. */
  tagline: z
    .string()
    .trim()
    .max(COMPANY_TAGLINE_MAX, `Máximo ${COMPANY_TAGLINE_MAX} caracteres`)
    .optional(),
  default_currency: z.string().optional(),
  folio_prefix_presupuesto: folioPrefixField,
  folio_prefix_ticket: folioPrefixField,
  experience_mode: z
    .union([z.enum(['campo', 'office', 'auto']), z.literal('')])
    .optional(),
  /** Datos para pagar (ZIG-23). Empty keeps the stored kind; absent on read is CLABE. */
  payment_kind: z.union([z.enum(['clabe', 'card', 'account']), z.literal('')]).optional(),
  payment_bank: z
    .string()
    .trim()
    .max(PAYMENT_BANK_MAX, `Máximo ${PAYMENT_BANK_MAX} caracteres`)
    .optional(),
  payment_holder: z
    .string()
    .trim()
    .max(PAYMENT_HOLDER_MAX, `Máximo ${PAYMENT_HOLDER_MAX} caracteres`)
    .optional(),
  payment_clabe: z.string().trim().optional(),
  payment_card: z.string().trim().optional(),
  payment_account: z.string().trim().optional(),
  payment_note: z
    .string()
    .trim()
    .max(PAYMENT_NOTE_MAX, `Máximo ${PAYMENT_NOTE_MAX} caracteres`)
    .optional(),
});

const digitsOnly = (value: string | undefined): boolean =>
  !value || /^[\d\s-]+$/.test(value);

const activePaymentKind = (
  value: z.infer<typeof companySettingsBaseSchema>,
): PaymentKind => (isPaymentKind(value.payment_kind) ? value.payment_kind : 'clabe');

/** The two series must tell documents apart, so their effective prefixes cannot match. */
export const companySettingsSchema = companySettingsBaseSchema.superRefine((value, ctx) => {
  const presupuesto =
    normalizeFolioPrefix(value.folio_prefix_presupuesto) || DEFAULT_FOLIO_PREFIX.presupuesto;
  const ticket = normalizeFolioPrefix(value.folio_prefix_ticket) || DEFAULT_FOLIO_PREFIX.ticket;
  if (presupuesto === ticket) {
    ctx.addIssue({
      code: 'custom',
      path: ['folio_prefix_ticket'],
      message: 'Los prefijos de presupuestos y recibos deben ser distintos',
    });
  }

  const kind = activePaymentKind(value);
  if (kind === 'clabe' && value.payment_clabe) {
    if (!digitsOnly(value.payment_clabe)) {
      ctx.addIssue({ code: 'custom', path: ['payment_clabe'], message: 'Usa solo números' });
    } else if (normalizeClabe(value.payment_clabe).length !== CLABE_LENGTH) {
      ctx.addIssue({
        code: 'custom',
        path: ['payment_clabe'],
        message: `La CLABE tiene ${CLABE_LENGTH} dígitos`,
      });
    } else if (!isValidClabe(value.payment_clabe)) {
      ctx.addIssue({
        code: 'custom',
        path: ['payment_clabe'],
        message: 'Revisa la CLABE: el último dígito no coincide',
      });
    }
  }
  if (kind === 'card' && value.payment_card) {
    if (!digitsOnly(value.payment_card)) {
      ctx.addIssue({ code: 'custom', path: ['payment_card'], message: 'Usa solo números' });
    } else if (
      normalizeClabe(value.payment_card).length < CARD_MIN_LENGTH ||
      normalizeClabe(value.payment_card).length > CARD_MAX_LENGTH
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['payment_card'],
        message: `La tarjeta tiene de ${CARD_MIN_LENGTH} a ${CARD_MAX_LENGTH} dígitos`,
      });
    } else if (!isValidCardNumber(value.payment_card)) {
      ctx.addIssue({
        code: 'custom',
        path: ['payment_card'],
        message: 'Revisa el número de tarjeta: los dígitos no coinciden',
      });
    }
  }
  if (kind === 'account' && value.payment_account) {
    if (!digitsOnly(value.payment_account)) {
      ctx.addIssue({ code: 'custom', path: ['payment_account'], message: 'Usa solo números' });
    } else if (!isValidAccountNumber(value.payment_account)) {
      ctx.addIssue({
        code: 'custom',
        path: ['payment_account'],
        message: `La cuenta tiene de ${ACCOUNT_MIN_LENGTH} a ${ACCOUNT_MAX_LENGTH} dígitos`,
      });
    }
  }
});

export const companyFormSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  email: z.string().email('El correo electrónico no es válido'),
  phone: z.string().min(1, 'El teléfono es requerido'),
  street: z.string().min(1, 'La calle es requerida'),
  interior_number: z.string().optional().or(z.literal('')),
  exterior_number: z.string().min(1, 'El número exterior es requerido'),
  neighborhood: z.string().min(1, 'La colonia es requerida'),
  city: z.string().min(1, 'La ciudad es requerida'),
  state: z.string().min(1, 'El estado es requerido'),
  country: z.string().min(1, 'El país es requerido'),
  postal_code: z.string().min(1, 'El código postal es requerido'),
  status: z.enum(['SETUP', 'ACTIVE', 'SUSPENDED', 'ARCHIVED']),
  settings: companySettingsSchema.optional(),
});

export type CompanyFormValues = z.infer<typeof companyFormSchema>;

/** Normalize optional strings for JSON storage (omit empties). */
export function normalizeCompanySettingsForDb(
  input: z.infer<typeof companySettingsSchema> | undefined,
): CompanySettingsJson | null {
  if (!input) {
    return null;
  }
  const out: CompanySettingsJson = {};
  const rfc = input.rfc?.trim();
  const cur = input.default_currency?.trim();
  if (rfc) {
    out.rfc = rfc;
  }
  if (cur) {
    out.default_currency = cur;
  }
  // Kept even when empty so clearing the field overrides the stored value on merge.
  if (input.tagline !== undefined) {
    out.tagline = input.tagline.trim();
  }
  // Kept even when empty so clearing a prefix returns to the default on merge.
  if (input.folio_prefix_presupuesto !== undefined) {
    out.folio_prefix_presupuesto = normalizeFolioPrefix(input.folio_prefix_presupuesto);
  }
  if (input.folio_prefix_ticket !== undefined) {
    out.folio_prefix_ticket = normalizeFolioPrefix(input.folio_prefix_ticket);
  }
  if (input.experience_mode === 'campo' || input.experience_mode === 'office') {
    out.experience_mode = input.experience_mode;
  }
  // Kept even when empty so clearing a field removes the stored value on merge.
  if (isPaymentKind(input.payment_kind)) {
    out.payment_kind = input.payment_kind;
  }
  if (input.payment_bank !== undefined) {
    out.payment_bank = input.payment_bank.trim();
  }
  if (input.payment_holder !== undefined) {
    out.payment_holder = input.payment_holder.trim();
  }
  if (input.payment_clabe !== undefined) {
    out.payment_clabe = normalizeClabe(input.payment_clabe);
  }
  if (input.payment_card !== undefined) {
    out.payment_card = normalizeClabe(input.payment_card);
  }
  if (input.payment_account !== undefined) {
    out.payment_account = normalizeClabe(input.payment_account);
  }
  if (input.payment_note !== undefined) {
    out.payment_note = input.payment_note.trim();
  }
  return Object.keys(out).length > 0 ? out : null;
}

export const mergeOnboardingChecklistDismiss = (
  existing: CompanySettingsJson | null | undefined,
  dismissedAt: string,
): CompanySettingsJson => ({
  ...(existing ?? {}),
  onboarding_checklist_dismissed_at: dismissedAt,
});

export const companyOwnerBootstrapSchema = z.object({
  name: z.string().min(1, 'El nombre del propietario es requerido'),
  email: z.string().email('El correo del propietario no es válido'),
  password: z
    .string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres'),
});

export const companyBootstrapSchema = companyFormSchema.extend({
  owner: companyOwnerBootstrapSchema,
});

export type CompanyBootstrapFormValues = z.infer<typeof companyBootstrapSchema>;

export const companyApiCreateSchema = companyBootstrapSchema;

export const companyApiUpdateSchema = companyFormSchema.extend({
  id: z.number().int().positive(),
});
