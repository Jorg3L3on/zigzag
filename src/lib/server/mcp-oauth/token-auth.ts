export const isValidPkceVerifier = (value: string | undefined): value is string =>
  typeof value === 'string' && value.length >= 43 && value.length <= 128;

export type AuthorizationCodeAuthResult =
  | { ok: true; codeVerifier: string }
  | { ok: false; error: 'invalid_request'; description: string };

/**
 * PKCE is the only proof on a code exchange (ZIG-38, same as micasa MIC-I5-1/4):
 * private_key_jwt is retired, so a client_assertion is ignored and never stands
 * in for code_verifier.
 */
export const resolveAuthorizationCodeAuth = (input: {
  codeVerifier?: string;
}): AuthorizationCodeAuthResult => {
  if (!isValidPkceVerifier(input.codeVerifier)) {
    return {
      ok: false,
      error: 'invalid_request',
      description: 'code_verifier requerido para PKCE S256',
    };
  }
  return { ok: true, codeVerifier: input.codeVerifier };
};
