import {
  checkDcrMetadata,
  impersonatesKnownClient,
  isAllowedDcrRedirectUri,
} from '@/lib/server/mcp-oauth/dcr-policy';

describe('DCR policy', () => {
  it.each([
    'https://example.com/callback',
    'http://127.0.0.1:8765/callback',
    'http://localhost:3000/cb',
    'http://[::1]:9000/cb',
  ])('accepts %s', (uri) => {
    expect(isAllowedDcrRedirectUri(uri)).toBe(true);
  });

  it.each([
    'myapp://callback',
    'javascript:alert(1)',
    'http://example.com/cb',
    'http://192.168.1.10/cb',
    'https://user:pass@example.com/cb',
    'https://example.com/cb#frag',
    'not a url',
  ])('rejects %s', (uri) => {
    expect(isAllowedDcrRedirectUri(uri)).toBe(false);
  });

  it.each(['ChatGPT', 'Open AI helper', 'GROK', 'x.AI', 'Claude Desktop', 'anthropic', 'Cursor'])(
    'treats "%s" as impersonating a known client',
    (name) => {
      expect(impersonatesKnownClient(name)).toBe(true);
    },
  );

  it('lets ordinary names through', () => {
    expect(impersonatesKnownClient('Mi agente de soporte')).toBe(false);
    expect(impersonatesKnownClient(undefined)).toBe(false);
  });

  it('reports the RFC 7591 error codes', () => {
    expect(checkDcrMetadata({ redirect_uris: ['myapp://cb'] })?.error).toBe(
      'invalid_redirect_uri',
    );
    expect(
      checkDcrMetadata({ client_name: 'chatgpt', redirect_uris: ['https://a.example/cb'] })
        ?.error,
    ).toBe('invalid_client_metadata');
    expect(
      checkDcrMetadata({ client_name: 'Agente', redirect_uris: ['https://a.example/cb'] }),
    ).toBeNull();
  });
});
