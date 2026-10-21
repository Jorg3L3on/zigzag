/**
 * What dynamic client registration accepts. DCR is open to anyone, so the
 * metadata is attacker-chosen: redirect URIs must be HTTPS (or loopback for
 * native clients), and a name that claims a known AI client (ChatGPT, Grok,
 * Claude, Cursor…) is only accepted when every redirect URI is on that
 * vendor's own hosts. Claude and Grok register through DCR under their own
 * names; a phishing client that borrows the name cannot receive the code there.
 */
import { clientNamedIn, isOfficialHost } from '@/lib/mcp-clients';

const LOOPBACK_HOSTNAMES = new Set(['127.0.0.1', 'localhost', '[::1]']);

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

export const impersonatesKnownClient = (
  name: string | undefined | null,
  redirectUris: string[],
): boolean => {
  const named = clientNamedIn(name);
  if (!named) return false;
  return !redirectUris.every((uri) => isOfficialHost(named, uri));
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
  if (impersonatesKnownClient(input.client_name, input.redirect_uris)) {
    return {
      error: 'invalid_client_metadata',
      description: 'client_name no puede hacerse pasar por un cliente conocido',
    };
  }
  return null;
};
