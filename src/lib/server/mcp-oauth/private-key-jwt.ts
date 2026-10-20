import {
  consumeJwtAssertionJti,
  JWT_ASSERTION_MAX_LIFETIME_S,
} from '@/lib/server/mcp-oauth/jwt-replay';

/** RFC 7523 JWT bearer client assertion. */
export const CLIENT_ASSERTION_JWT_BEARER =
  'urn:ietf:params:oauth:client-assertion-type:jwt-bearer';

export type VerifyPrivateKeyJwtParams = {
  clientAssertion: string;
  clientAssertionType: string | undefined;
  requestClientId: string;
  codeClientId?: string;
  request?: Request;
  jwksUri: string;
  jwksJson?: JsonWebKeySet;
  fetchImpl?: typeof fetch;
  /** Replay store; defaults to the McpOAuthJwtAssertion table. */
  consumeJti?: typeof consumeJwtAssertionJti;
};

type JsonWebKeySet = {
  keys: JsonWebKey[];
};

const normalizeAudiences = (aud: unknown): string[] => {
  if (typeof aud === 'string') return [aud];
  if (Array.isArray(aud)) {
    return aud.filter((value): value is string => typeof value === 'string');
  }
  return [];
};

const audienceMatches = (aud: unknown, acceptedAudiences: string[]): boolean => {
  const normalizedAccepted = new Set(
    acceptedAudiences.map((value) => value.replace(/\/$/, '')),
  );
  return normalizeAudiences(aud).some((value) =>
    normalizedAccepted.has(value.replace(/\/$/, '')),
  );
};

const claimMatchesAllowedClient = (
  claim: unknown,
  allowedClientIds: string[],
): boolean => typeof claim === 'string' && allowedClientIds.includes(claim);

export const verifyPrivateKeyJwtAssertion = async (
  params: VerifyPrivateKeyJwtParams,
): Promise<boolean> => {
  if (params.clientAssertionType !== CLIENT_ASSERTION_JWT_BEARER) {
    return false;
  }

  const { buildAllowedJwtClientIds } = await import('@/lib/server/mcp-oauth/cimd');
  const { buildOAuthTokenAudiences } = await import('@/lib/server/mcp-oauth/config');
  const { logOAuthJwtAssertionRejected } = await import(
    '@/lib/server/mcp-oauth/oauth-token-log'
  );

  const allowedClientIds = buildAllowedJwtClientIds(
    params.requestClientId,
    params.codeClientId,
  );
  const acceptedAudiences = buildOAuthTokenAudiences(params.request);

  try {
    const { createLocalJWKSet, jwtVerify } = await import('jose');

    let jwks: JsonWebKeySet;
    if (params.jwksJson) {
      jwks = params.jwksJson;
    } else {
      const { fetchJsonDocument } = await import('@/lib/server/mcp-oauth/fetch-document');
      const fetched = await fetchJsonDocument(params.jwksUri, {
        fetchImpl: params.fetchImpl,
      });
      if (fetched == null || typeof fetched !== 'object') return false;
      jwks = fetched as JsonWebKeySet;
    }

    if (!Array.isArray(jwks.keys) || jwks.keys.length === 0) {
      return false;
    }

    const keySet = createLocalJWKSet(jwks);
    const { payload, protectedHeader } = await jwtVerify(
      params.clientAssertion,
      keySet,
      {
        algorithms: ['RS256'],
        clockTolerance: 60,
      },
    );

    const audOk = audienceMatches(payload.aud, acceptedAudiences);
    const issOk = claimMatchesAllowedClient(payload.iss, allowedClientIds);
    const subOk = claimMatchesAllowedClient(payload.sub, allowedClientIds);

    const lifetimeOk =
      typeof payload.exp === 'number' &&
      typeof payload.iat === 'number' &&
      payload.exp - payload.iat <= JWT_ASSERTION_MAX_LIFETIME_S;
    const jtiOk = typeof payload.jti === 'string' && payload.jti.length > 0;

    if (!audOk || !issOk || !subOk || !lifetimeOk || !jtiOk) {
      logOAuthJwtAssertionRejected({
        iss: typeof payload.iss === 'string' ? payload.iss : undefined,
        aud: payload.aud,
        sub: typeof payload.sub === 'string' ? payload.sub : undefined,
        typ:
          typeof payload.typ === 'string'
            ? payload.typ
            : typeof protectedHeader.typ === 'string'
              ? protectedHeader.typ
              : undefined,
      });
      return false;
    }

    // Single use: a jti seen before is a replayed assertion.
    const consume = params.consumeJti ?? consumeJwtAssertionJti;
    const fresh = await consume({
      jti: payload.jti as string,
      clientId: payload.iss as string,
      expiresAt: new Date((payload.exp as number) * 1000),
    });
    if (!fresh) {
      logOAuthJwtAssertionRejected({
        iss: payload.iss as string,
        aud: payload.aud,
        sub: payload.sub as string,
        error: 'jti_replay',
      });
      return false;
    }

    return true;
  } catch (error) {
    try {
      const { decodeJwt } = await import('jose');
      const payload = decodeJwt(params.clientAssertion);
      logOAuthJwtAssertionRejected({
        iss: typeof payload.iss === 'string' ? payload.iss : undefined,
        aud: payload.aud,
        sub: typeof payload.sub === 'string' ? payload.sub : undefined,
        typ: typeof payload.typ === 'string' ? payload.typ : undefined,
        error: error instanceof Error ? error.message : String(error),
      });
    } catch {
      // ignore decode failures
    }
    return false;
  }
};
