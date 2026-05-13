import { z } from 'zod';
import type { CompanySettingsJson } from '@/db/schema';

/** Settings stored in `Company.settings` (JSON). Replace-on-save from the form. */
export const companySettingsSchema = z.object({
  rfc: z.string().optional(),
  invoice_footer_note: z.string().optional(),
  default_currency: z.string().optional(),
});

export const companyFormSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  email: z.string().email('El correo electrónico no es válido'),
  phone: z.string().min(1, 'El teléfono es requerido'),
  logo: z.string().optional().or(z.literal('')),
  street: z.string().min(1, 'La calle es requerida'),
  interior_number: z.string().optional().or(z.literal('')),
  exterior_number: z.string().min(1, 'El número exterior es requerido'),
  neighborhood: z.string().min(1, 'La colonia es requerida'),
  city: z.string().min(1, 'La ciudad es requerida'),
  state: z.string().min(1, 'El estado es requerido'),
  country: z.string().min(1, 'El país es requerido'),
  postal_code: z.string().min(1, 'El código postal es requerido'),
  status: z.enum(['ACTIVE', 'INACTIVE']),
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
  const note = input.invoice_footer_note?.trim();
  const cur = input.default_currency?.trim();
  if (rfc) {
    out.rfc = rfc;
  }
  if (note) {
    out.invoice_footer_note = note;
  }
  if (cur) {
    out.default_currency = cur;
  }
  return Object.keys(out).length > 0 ? out : null;
}

export const companyApiCreateSchema = companyFormSchema;

export const companyApiUpdateSchema = companyFormSchema.extend({
  id: z.number().int().positive(),
});
