/**
 * @jest-environment node
 */
import {
  DOCUMENT_MAX_BYTES,
  fetchJsonDocument,
  isSafeDocumentUrl,
} from '@/lib/server/mcp-oauth/fetch-document';

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  });

describe('isSafeDocumentUrl', () => {
  it.each([
    'http://chatgpt.com/oauth/client.json',
    'https://127.0.0.1/doc.json',
    'https://10.0.0.5/doc.json',
    'https://[::1]/doc.json',
    'https://2130706433/doc.json',
    'https://0x7f.1/doc.json',
    'https://localhost/doc.json',
    'https://intranet/doc.json',
    'https://printer.local/doc.json',
    'https://metadata.internal/doc.json',
    'https://app.localhost/doc.json',
    'https://user:pw@example.com/doc.json',
  ])('refuses %s', (url) => {
    expect(isSafeDocumentUrl(url)).toBe(false);
  });

  it('accepts a public https name', () => {
    expect(isSafeDocumentUrl('https://chatgpt.com/oauth/client.json')).toBe(true);
  });
});

describe('fetchJsonDocument', () => {
  it('returns the parsed document', async () => {
    const fetchImpl = jest.fn(async () => json({ keys: [] }));
    await expect(
      fetchJsonDocument('https://example.com/jwks.json', { fetchImpl }),
    ).resolves.toEqual({ keys: [] });
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://example.com/jwks.json',
      expect.objectContaining({ redirect: 'manual' }),
    );
  });

  it('never calls fetch for an unsafe URL', async () => {
    const fetchImpl = jest.fn();
    await expect(
      fetchJsonDocument('https://169.254.169.254/latest/meta-data', { fetchImpl }),
    ).resolves.toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('caps the body at 64 KiB, declared or streamed', async () => {
    const big = 'x'.repeat(DOCUMENT_MAX_BYTES + 1);
    const declared = jest.fn(
      async () =>
        new Response(big, { headers: { 'content-length': String(big.length) } }),
    );
    await expect(
      fetchJsonDocument('https://example.com/a.json', { fetchImpl: declared }),
    ).resolves.toBeNull();

    const streamed = jest.fn(
      async () =>
        new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode(`"${big}"`));
              controller.close();
            },
          }),
        ),
    );
    await expect(
      fetchJsonDocument('https://example.com/b.json', { fetchImpl: streamed }),
    ).resolves.toBeNull();
  });

  it('follows one redirect on the same host only', async () => {
    const sameHost = jest
      .fn()
      .mockResolvedValueOnce(
        new Response(null, { status: 302, headers: { location: '/v2/doc.json' } }),
      )
      .mockResolvedValueOnce(json({ ok: true }));
    await expect(
      fetchJsonDocument('https://example.com/doc.json', { fetchImpl: sameHost }),
    ).resolves.toEqual({ ok: true });

    const otherHost = jest.fn().mockResolvedValueOnce(
      new Response(null, { status: 302, headers: { location: 'https://evil.example.net/x' } }),
    );
    await expect(
      fetchJsonDocument('https://example.com/doc.json', { fetchImpl: otherHost }),
    ).resolves.toBeNull();
    expect(otherHost).toHaveBeenCalledTimes(1);

    const twice = jest
      .fn()
      .mockResolvedValue(new Response(null, { status: 302, headers: { location: '/again' } }));
    await expect(
      fetchJsonDocument('https://example.com/doc.json', { fetchImpl: twice }),
    ).resolves.toBeNull();
    expect(twice).toHaveBeenCalledTimes(2);
  });

  it('returns null on errors and non-JSON bodies', async () => {
    await expect(
      fetchJsonDocument('https://example.com/a.json', {
        fetchImpl: jest.fn(async () => new Response('nope', { status: 500 })),
      }),
    ).resolves.toBeNull();
    await expect(
      fetchJsonDocument('https://example.com/a.json', {
        fetchImpl: jest.fn(async () => new Response('<html>')),
      }),
    ).resolves.toBeNull();
  });
});
