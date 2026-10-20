import { z } from 'zod';

/** API keys expire after a year at most; 365 days when the client sends nothing. */
export const API_KEY_MAX_DAYS = 365;

export const createApiKeySchema = z.object({
  name: z.string().trim().min(1).max(120),
  scopes: z
    .array(z.enum(['read', 'write']))
    .min(1)
    .default(['read']),
  allowed_company_ids: z.array(z.number().int().positive()).min(1),
  expires_in_days: z
    .number()
    .int()
    .positive()
    .max(API_KEY_MAX_DAYS)
    .default(API_KEY_MAX_DAYS),
});

export const updateApiKeySchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  allowed_company_ids: z.array(z.number().int().positive()).min(1).optional(),
});

export const updateOAuthGrantSchema = z.object({
  allowed_company_ids: z.array(z.number().int().positive()).min(1),
});
