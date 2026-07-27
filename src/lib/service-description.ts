import { z } from 'zod';

/** Max length for Service description (form, actions, CSV). No DB migration in v1. */
export const SERVICE_DESCRIPTION_MAX_LENGTH = 120;

export const SERVICE_DESCRIPTION_MAX_MESSAGE = `La descripción no puede exceder ${SERVICE_DESCRIPTION_MAX_LENGTH} caracteres`;

export const serviceDescriptionSchema = z
  .string()
  .trim()
  .min(1, 'La descripción es obligatoria')
  .max(SERVICE_DESCRIPTION_MAX_LENGTH, SERVICE_DESCRIPTION_MAX_MESSAGE);

export const serviceWriteSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio'),
  description: serviceDescriptionSchema,
  price: z.coerce.number().nonnegative('El precio debe ser un número válido'),
});

export type ServiceWriteInput = z.infer<typeof serviceWriteSchema>;
