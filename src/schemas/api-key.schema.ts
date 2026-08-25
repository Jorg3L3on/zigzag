import { z } from 'zod';

export const createApiKeySchema = z.object({
  name: z.string().trim().min(1).max(120),
  scopes: z
    .array(z.enum(['read', 'write']))
    .min(1)
    .default(['read']),
  allowed_company_ids: z.array(z.number().int().positive()).min(1),
  expires_in_days: z.number().int().positive().max(3650).optional(),
});

export const updateApiKeySchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  allowed_company_ids: z.array(z.number().int().positive()).min(1).optional(),
});

export const updateOAuthGrantSchema = z.object({
  allowed_company_ids: z.array(z.number().int().positive()).min(1),
});
