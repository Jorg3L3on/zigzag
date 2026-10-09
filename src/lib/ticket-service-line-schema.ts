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

/**
 * A line that points at a catalog Service. `kind` is optional so payloads from
 * before ZIG-I5 (`{ service_id, quantity, price }`) keep parsing as catalog lines.
 */
export const catalogServiceLineSchema = serviceLineMoneySchema.extend({
  kind: z.literal('catalog').optional(),
  service_id: z.number().int().positive(),
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
export type UpdateServiceTicketData = z.infer<typeof serviceLineMoneySchema>;

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
}): ServiceLineInput =>
  row.service_id == null
    ? {
        kind: 'custom',
        name: row.name?.trim() || 'Servicio',
        description: row.description ?? undefined,
        save_to_catalog: false,
        quantity: row.quantity,
        price: Number(row.price),
      }
    : {
        service_id: row.service_id,
        quantity: row.quantity,
        price: Number(row.price),
      };
