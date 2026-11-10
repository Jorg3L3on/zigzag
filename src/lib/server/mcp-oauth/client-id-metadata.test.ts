import { parseClientIdMetadataDocument } from '@/lib/server/mcp-oauth/client-id-metadata';
import { tokenClientIdMatchesCode } from '@/lib/server/mcp-oauth/clients';

jest.mock('@/lib/db', () => ({ db: {} }));

const CLIENT_ID = 'https://cimd.example.com/oauth/client.json';

describe('CIMD documents follow the DCR redirect rules (ZIG-38)', () => {
  it('drops javascript:, data:, custom-scheme and plain-http redirect URIs', () => {
    const doc = parseClientIdMetadataDocument(CLIENT_ID, {
      client_id: CLIENT_ID,
      client_name: 'Cliente CIMD',
      redirect_uris: [
        'javascript:alert(document.cookie)',
        'data:text/html,<script>alert(1)</script>',
        'myapp://cb',
        'http://evil.example.com/cb',
        'http://127.0.0.1:4567/cb',
        'https://cimd.example.com/cb',
      ],
    });
    expect(doc?.redirect_uris).toEqual([
      'http://127.0.0.1:4567/cb',
      'https://cimd.example.com/cb',
    ]);
  });

  it('rejects a document with no allowed redirect URI left', () => {
    expect(
      parseClientIdMetadataDocument(CLIENT_ID, {
        client_id: CLIENT_ID,
        redirect_uris: ['javascript:alert(1)'],
      }),
    ).toBeNull();
  });

  it('keeps client_uri and logo_uri only when https', () => {
    const doc = parseClientIdMetadataDocument(CLIENT_ID, {
      client_id: CLIENT_ID,
      redirect_uris: ['https://cimd.example.com/cb'],
      client_uri: 'javascript:alert(1)',
      logo_uri: 'https://cimd.example.com/logo.png',
    });
    expect(doc?.client_uri).toBeUndefined();
    expect(doc?.logo_uri).toBe('https://cimd.example.com/logo.png');
  });
});

describe('tokenClientIdMatchesCode (ZIG-38)', () => {
  it('needs the same client_id', () => {
    expect(tokenClientIdMatchesCode('a', 'a')).toBe(true);
    expect(tokenClientIdMatchesCode('a', 'b')).toBe(false);
  });

  it('lets ChatGPT rotate between CIMD URLs on its trusted hosts only', () => {
    expect(
      tokenClientIdMatchesCode(
        'https://chatgpt.com/oauth/abc/client.json',
        'https://chatgpt.com/oauth/client.json',
      ),
    ).toBe(true);
    expect(
      tokenClientIdMatchesCode(
        'https://evil.example.com/oauth/client.json',
        'https://chatgpt.com/oauth/client.json',
      ),
    ).toBe(false);
  });
});
