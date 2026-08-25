export const logOAuthTokenFailure = (input: {
  grant_type: string;
  has_code: boolean;
  has_verifier: boolean;
  has_assertion: boolean;
  client_id_host: string | null;
  error: string;
}): void => {
  console.warn(
    JSON.stringify({
      severity: 'warn',
      event: 'oauth.token.failed',
      grant_type: input.grant_type,
      has_code: input.has_code,
      has_verifier: input.has_verifier,
      has_assertion: input.has_assertion,
      client_id_host: input.client_id_host,
      error: input.error,
      at: new Date().toISOString(),
    }),
  );
};

export const clientIdHostOnly = (clientId: string): string | null => {
  if (!clientId?.trim()) return null;
  try {
    if (clientId.includes('://')) {
      return new URL(clientId).hostname;
    }
  } catch {
    return 'other';
  }
  return 'uuid';
};

export const logOAuthJwtAssertionRejected = (input: {
  iss?: string;
  aud?: unknown;
  sub?: string;
  typ?: string;
  error?: string;
}): void => {
  console.warn(
    JSON.stringify({
      severity: 'warn',
      event: 'oauth.jwt_assertion.rejected',
      iss_host: input.iss ? clientIdHostOnly(input.iss) : null,
      sub_host: input.sub ? clientIdHostOnly(input.sub) : null,
      typ: input.typ ?? null,
      aud_count: Array.isArray(input.aud)
        ? input.aud.length
        : input.aud
          ? 1
          : 0,
      error: input.error ?? null,
      at: new Date().toISOString(),
    }),
  );
};
