import { z } from 'zod';
import {
  SERVICE_DESCRIPTION_MAX_LENGTH,
  SERVICE_DESCRIPTION_MAX_MESSAGE,
} from '@/lib/service-description';

/** Runtime money-line rules (TCI-02). Quantity ≥ 1, price ≥ 0, both finite. */
export const serviceLineMoneySchema = z.object({
  quantity: z.number().finite().min(1),
  price: z.number().finite().min(0),
});

/** Max length of an inline line name (ServicesTickets.name is varchar(100)). */
export const SERVICE_LINE_NAME_MAX_LENGTH = 100;

/** Max length of a material name / unit (TicketLineMaterial columns). */
export const MATERIAL_NAME_MAX_LENGTH = 100;
export const MATERIAL_UNIT_MAX_LENGTH = 20;
/** Max materials under one document line or one catalog service. */
export const MATERIALS_PER_LINE_MAX = 30;

const materialUnitSchema = z
  .string()
  .trim()
  .max(MATERIAL_UNIT_MAX_LENGTH)
  .nullable()
  .optional()
  .transform((value) => (value ? value : null));

/** Material quantities allow two decimals (2.5 m); price is per unit. */
export const materialMoneySchema = z.object({
  quantity: z.number().finite().min(0.01).max(9999.99),
  price: z.number().finite().min(0).max(99_999_999.99),
});

/** A material from the company catalog (ZIG-I10). The server snapshots its name and unit. */
export const catalogMaterialLineSchema = materialMoneySchema.extend({
  kind: z.literal('catalog').optional(),
  material_id: z.number().int().positive(),
});

/**
 * A material typed in the composer that lives only in its line, unless
 * `save_to_catalog` is on: then the server also creates (or reuses, by name)
 * the company Material in the same transaction.
 */
export const customMaterialLineSchema = materialMoneySchema.extend({
  kind: z.literal('custom'),
  name: z
    .string()
    .trim()
    .min(1, 'El nombre del material es obligatorio')
    .max(MATERIAL_NAME_MAX_LENGTH),
  unit: materialUnitSchema,
  save_to_catalog: z.boolean().optional().default(false),
});

export const materialLineInputSchema = z.union([
  customMaterialLineSchema,
  catalogMaterialLineSchema,
]);

const lineMaterialsSchema = z
  .array(materialLineInputSchema)
  .max(MATERIALS_PER_LINE_MAX)
  .optional()
  .default([]);

export type MaterialLineInput = z.input<typeof materialLineInputSchema>;
export type ParsedMaterialLine = z.output<typeof materialLineInputSchema>;

export const isCustomMaterialLine = (
  line: ParsedMaterialLine,
): line is z.output<typeof customMaterialLineSchema> => line.kind === 'custom';

/**
 * A line that points at a catalog Service. `kind` is optional so payloads from
 * before ZIG-I5 (`{ service_id, quantity, price }`) keep parsing as catalog lines.
 */
export const catalogServiceLineSchema = serviceLineMoneySchema.extend({
  kind: z.literal('catalog').optional(),
  service_id: z.number().int().positive(),
  materials: lineMaterialsSchema,
});

/**
 * An inline line typed in the composer or add-service panel (ZIG-I5 D2). It lives
 * only in its document unless `save_to_catalog` is on, in which case the server
 * also creates the Service in the same transaction.
 */
export const customServiceLineSchema = serviceLineMoneySchema.extend({
  kind: z.literal('custom'),
  name: z
    .string()
    .trim()
    .min(1, 'El nombre del servicio es obligatorio')
    .max(SERVICE_LINE_NAME_MAX_LENGTH),
  description: z
    .string()
    .trim()
    .max(SERVICE_DESCRIPTION_MAX_LENGTH, SERVICE_DESCRIPTION_MAX_MESSAGE)
    .optional()
    .transform((value) => (value ? value : undefined)),
  save_to_catalog: z.boolean().optional().default(false),
  materials: lineMaterialsSchema,
});

/** Catalog or inline line, plus quantity and price. */
export const serviceLineInputSchema = z.union([
  customServiceLineSchema,
  catalogServiceLineSchema,
]);

/** Composer limits on top of the line rules (ZIG-I2-4): whole quantities, bounded price. */
export const composerServiceLineSchema = serviceLineInputSchema.and(
  z.object({
    quantity: z.number().int().min(1).max(9999),
    price: z.number().finite().min(0).max(99_999_999.99),
  }),
);

export type CatalogServiceLineInput = z.input<typeof catalogServiceLineSchema>;
export type CustomServiceLineInput = z.input<typeof customServiceLineSchema>;
export type ServiceLineInput = z.input<typeof serviceLineInputSchema>;
export type ParsedServiceLine = z.output<typeof serviceLineInputSchema>;

export const isCustomServiceLine = (
  line: ParsedServiceLine,
): line is z.output<typeof customServiceLineSchema> => line.kind === 'custom';

export type CreateServiceTicketData = ServiceLineInput;

/**
 * Editing a saved line: quantity and price, plus its whole material set when
 * `materials` is sent (omitted = materials untouched).
 */
export const updateServiceLineSchema = serviceLineMoneySchema.extend({
  materials: z.array(materialLineInputSchema).max(MATERIALS_PER_LINE_MAX).optional(),
});
export type UpdateServiceTicketData = z.input<typeof updateServiceLineSchema>;

/** A stored TicketLineMaterial row as readers and forms see it. */
export type StoredLineMaterial = {
  material_id: number | null;
  name: string | null;
  unit: string | null;
  quantity: number | string;
  price: number | string;
};

/**
 * Maps stored material rows back to inputs. Catalog rows stay linked to their
 * Material; the server re-snapshots name and unit from the catalog on save.
 */
export const materialInputsFromRows = (
  rows: ReadonlyArray<StoredLineMaterial> | null | undefined,
): MaterialLineInput[] =>
  (rows ?? []).map((row) =>
    row.material_id == null
      ? {
          kind: 'custom',
          name: row.name?.trim() || 'Material',
          unit: row.unit,
          save_to_catalog: false,
          quantity: Number(row.quantity),
          price: Number(row.price),
        }
      : {
          kind: 'catalog',
          material_id: row.material_id,
          quantity: Number(row.quantity),
          price: Number(row.price),
        },
  );

/**
 * Maps a stored ServicesTickets row back to a line input, keeping inline lines
 * inline (used by forms that re-submit every line on save).
 */
export const serviceLineInputFromRow = (row: {
  service_id: number | null;
  name?: string | null;
  description?: string | null;
  quantity: number;
  price: number | string;
  materials?: ReadonlyArray<StoredLineMaterial> | null;
}): ServiceLineInput => {
  const materials = materialInputsFromRows(row.materials);
  return row.service_id == null
    ? {
        kind: 'custom',
        name: row.name?.trim() || 'Servicio',
        description: row.description ?? undefined,
        save_to_catalog: false,
        quantity: row.quantity,
        price: Number(row.price),
        ...(materials.length > 0 ? { materials } : {}),
      }
    : {
        service_id: row.service_id,
        quantity: row.quantity,
        price: Number(row.price),
        ...(materials.length > 0 ? { materials } : {}),
      };
};
