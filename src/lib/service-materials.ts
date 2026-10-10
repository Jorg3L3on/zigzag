import { z } from 'zod';
import {
  MATERIAL_NAME_MAX_LENGTH,
  MATERIAL_UNIT_MAX_LENGTH,
  MATERIALS_PER_LINE_MAX,
} from '@/lib/ticket-service-line-schema';

/** Unit chips offered by the forms (free text is allowed too). */
export const MATERIAL_UNIT_SUGGESTIONS = ['pza', 'm', 'kg', 'lt', 'hr'] as const;

/**
 * One default material of a catalog Service, as the Servicios form sends it
 * (ZIG-I10). `material_id` links a catalog Material; without it the server
 * finds the company Material by name (case-insensitive) or creates it.
 */
export const serviceMaterialInputSchema = z.object({
  material_id: z.number().int().positive().nullable().optional(),
  name: z
    .string()
    .trim()
    .min(1, 'El nombre del material es obligatorio')
    .max(MATERIAL_NAME_MAX_LENGTH),
  unit: z
    .string()
    .trim()
    .max(MATERIAL_UNIT_MAX_LENGTH)
    .nullable()
    .optional()
    .transform((value) => (value ? value : null)),
  quantity: z.number().finite().min(0.01).max(9999.99),
  price: z.number().finite().min(0).max(99_999_999.99),
});

export const serviceMaterialsInputSchema = z
  .array(serviceMaterialInputSchema)
  .max(MATERIALS_PER_LINE_MAX);

export type ServiceMaterialInput = z.input<typeof serviceMaterialInputSchema>;
export type ParsedServiceMaterial = z.output<typeof serviceMaterialInputSchema>;

/** A service's default material as readers see it: catalog data + this service's qty/price. */
export type ServiceMaterialView = {
  id: number;
  material_id: number;
  name: string;
  unit: string | null;
  quantity: number;
  /** Effective price for this service (override ?? catalog). */
  price: number;
  catalog_price: number;
};

/** A catalog Material offered by autocomplete. */
export type MaterialOption = {
  id: number;
  name: string;
  unit: string | null;
  price: number;
};
