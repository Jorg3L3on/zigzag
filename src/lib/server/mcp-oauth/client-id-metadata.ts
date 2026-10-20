import { z } from 'zod';
import {
  cimdClientIdsMatch,
  isClientIdMetadataUrl,
} from '@/lib/server/mcp-oauth/cimd';
import {
  fetchJsonDocument,
  type FetchJsonDocumentOptions,
} from '@/lib/server/mcp-oauth/fetch-document';

const clientMetadataSchema = z
  .object({
    client_id: z.string().url(),
    client_name: z.string().min(1).optional(),
    redirect_uris: z.array(z.string().url()).min(1),
    grant_types: z.array(z.string()).optional(),
    response_types: z.array(z.string()).optional(),
    token_endpoint_auth_method: z.string().optional(),
    token_endpoint_auth_methods_supported: z.array(z.string()).optional(),
    client_uri: z.string().url().optional(),
    logo_uri: z.string().url().optional(),
    jwks_uri: z.string().url().optional(),
    token_endpoint_auth_signing_alg: z.string().optional(),
  })
  .passthrough();

export type ClientIdMetadataDocument = z.infer<typeof clientMetadataSchema> & {
  client_name: string;
};

export const parseClientIdMetadataDocument = (
  fetchUrl: string,
  json: unknown,
): ClientIdMetadataDocument | null => {
  const parsed = clientMetadataSchema.safeParse(json);
  if (!parsed.success) return null;
  if (!cimdClientIdsMatch(fetchUrl, parsed.data.client_id)) return null;

  return {
    ...parsed.data,
    client_name: parsed.data.client_name?.trim() || 'OAuth client',
  };
};

export const fetchClientIdMetadataDocument = async (
  clientId: string,
  options: FetchJsonDocumentOptions = {},
): Promise<ClientIdMetadataDocument | null> => {
  if (!isClientIdMetadataUrl(clientId)) return null;
  const json = await fetchJsonDocument(clientId, options);
  if (json == null) return null;
  return parseClientIdMetadataDocument(clientId, json);
};

export { isClientIdMetadataUrl } from '@/lib/server/mcp-oauth/cimd';
export { validateRedirectUri } from '@/lib/server/mcp-oauth/cimd';
