/**
 * What dynamic client registration accepts. DCR is open to anyone, so the
 * metadata is attacker-chosen: redirect URIs must be HTTPS (or loopback for
 * native clients) and names may not pose as a known AI client, since the real
 * ones arrive through CIMD from a trusted host.
 */
const LOOPBACK_HOSTNAMES = new Set(['127.0.0.1', 'localhost', '[::1]']);

export const IMPERSONATED_CLIENT_NAMES = [
  'chatgpt',
  'openai',
  'grok',
  'xai',
  'claude',
  'anthropic',
  'cursor',
] as const;

export const isAllowedDcrRedirectUri = (value: string): boolean => {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.username || url.password || url.hash) return false;
  if (url.protocol === 'https:') return true;
  return url.protocol === 'http:' && LOOPBACK_HOSTNAMES.has(url.hostname);
};

export const impersonatesKnownClient = (name: string | undefined | null): boolean => {
  if (!name) return false;
  const normalized = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  return IMPERSONATED_CLIENT_NAMES.some((known) => normalized.includes(known));
};

export type DcrPolicyError = {
  error: 'invalid_redirect_uri' | 'invalid_client_metadata';
  description: string;
};

export const checkDcrMetadata = (input: {
  client_name?: string;
  redirect_uris: string[];
}): DcrPolicyError | null => {
  const rejected = input.redirect_uris.find((uri) => !isAllowedDcrRedirectUri(uri));
  if (rejected) {
    return {
      error: 'invalid_redirect_uri',
      description:
        'redirect_uris debe usar https:// (o http:// solo en 127.0.0.1, localhost o [::1])',
    };
  }
  if (impersonatesKnownClient(input.client_name)) {
    return {
      error: 'invalid_client_metadata',
      description: 'client_name no puede hacerse pasar por un cliente conocido',
    };
  }
  return null;
};
