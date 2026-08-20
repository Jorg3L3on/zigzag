import { z } from 'zod';

export const AnotarCaptureInput = z
  .object({
    client_id: z.number().optional(),
    client_name: z.string().min(1),
    client_tel: z.string().min(1),
    work_notes: z.string().optional().default(''),
    total: z.number().min(0),
    paid: z.number().min(0),
    company_id: z.number(),
    ticket_date: z.date().optional(),
  })
  .refine((data) => data.paid <= data.total, {
    message: 'El monto pagado no puede ser mayor al total',
    path: ['paid'],
  });

export type AnotarCaptureData = z.infer<typeof AnotarCaptureInput>;
