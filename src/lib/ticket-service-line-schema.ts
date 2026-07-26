import { z } from 'zod';

/** Runtime money-line rules (TCI-02). Quantity ≥ 1, price ≥ 0, both finite. */
export const serviceLineMoneySchema = z.object({
  quantity: z.number().finite().min(1),
  price: z.number().finite().min(0),
});

export const createServiceTicketSchema = serviceLineMoneySchema.extend({
  service_id: z.number().int().positive(),
});

export type CreateServiceTicketData = z.infer<typeof createServiceTicketSchema>;
export type UpdateServiceTicketData = z.infer<typeof serviceLineMoneySchema>;
