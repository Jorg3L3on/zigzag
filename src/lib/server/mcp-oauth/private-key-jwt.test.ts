/**
 * @jest-environment node
 */
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import {
  CLIENT_ASSERTION_JWT_BEARER,
  verifyPrivateKeyJwtAssertion,
} from '@/lib/server/mcp-oauth/private-key-jwt';

jest.mock('@/lib/db', () => ({ db: {} }));

const CLIENT_ID = 'https://chatgpt.com/oauth/client.json';
const TOKEN_URL = 'https://zigzag.example.com/api/oauth/token';
const request = new Request(TOKEN_URL, { method: 'POST' });

describe('private_key_jwt client assertions', () => {
  let privateKey: CryptoKey;
  let jwks: { keys: JsonWebKey[] };

  beforeAll(async () => {
    const pair = await generateKeyPair('RS256', { extractable: true });
    privateKey = pair.privateKey as CryptoKey;
    jwks = { keys: [{ ...(await exportJWK(pair.publicKey)), alg: 'RS256' } as JsonWebKey] };
  });

  const sign = (claims: { jti?: string; lifetimeS?: number } = {}) => {
    const now = Math.floor(Date.now() / 1000);
    let jwt = new SignJWT({})
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuer(CLIENT_ID)
      .setSubject(CLIENT_ID)
      .setAudience(TOKEN_URL)
      .setIssuedAt(now)
      .setExpirationTime(now + (claims.lifetimeS ?? 300));
    if (claims.jti !== '') jwt = jwt.setJti(claims.jti ?? crypto.randomUUID());
    return jwt.sign(privateKey);
  };

  const verify = async (assertion: string, seen: Set<string>) =>
    verifyPrivateKeyJwtAssertion({
      clientAssertion: assertion,
      clientAssertionType: CLIENT_ASSERTION_JWT_BEARER,
      requestClientId: CLIENT_ID,
      request,
      jwksUri: 'https://chatgpt.com/oauth/jwks.json',
      jwksJson: jwks,
      consumeJti: async ({ jti }) => {
        if (seen.has(jti)) return false;
        seen.add(jti);
        return true;
      },
    });

  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('accepts a fresh assertion once and rejects the replayed jti', async () => {
    const seen = new Set<string>();
    const assertion = await sign({ jti: 'jti-1' });
    await expect(verify(assertion, seen)).resolves.toBe(true);
    await expect(verify(assertion, seen)).resolves.toBe(false);
  });

  it('rejects an assertion that lives longer than 10 minutes', async () => {
    const assertion = await sign({ lifetimeS: 11 * 60 });
    await expect(verify(assertion, new Set())).resolves.toBe(false);
  });

  it('rejects an assertion without a jti', async () => {
    const assertion = await sign({ jti: '' });
    await expect(verify(assertion, new Set())).resolves.toBe(false);
  });

  it('fetches the JWKS through the guarded fetcher (no IP-literal hosts)', async () => {
    const fetchImpl = jest.fn();
    const assertion = await sign();
    await expect(
      verifyPrivateKeyJwtAssertion({
        clientAssertion: assertion,
        clientAssertionType: CLIENT_ASSERTION_JWT_BEARER,
        requestClientId: CLIENT_ID,
        request,
        jwksUri: 'https://10.0.0.1/jwks.json',
        fetchImpl,
        consumeJti: async () => true,
      }),
    ).resolves.toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
