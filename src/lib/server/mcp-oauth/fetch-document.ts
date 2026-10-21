/**
 * Fetches a small JSON document from a URL a client gave us (CIMD client_id,
 * jwks_uri). Those URLs are attacker-chosen, so the fetch refuses anything that
 * could reach inside our network or exhaust memory: HTTPS only, no IP-literal
 * hosts, no localhost / single-label / .local / .internal names, at most one
 * redirect and only to the same host, and a hard cap on the body size.
 */
export const DOCUMENT_MAX_BYTES = 64 * 1024;
export const DOCUMENT_TIMEOUT_MS = 10_000;

const PRIVATE_SUFFIXES = ['.localhost', '.local', '.internal', '.lan', '.home.arpa'];

const isIpLiteral = (hostname: string): boolean =>
  hostname.startsWith('[') ||
  hostname.includes(':') ||
  /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) ||
  // Numeric forms URL parsing may leave alone (e.g. 0x7f.1, 2130706433).
  /^(0x[0-9a-f]+|\d+)(\.(0x[0-9a-f]+|\d+))*$/i.test(hostname);

export const isSafeDocumentUrl = (value: string): boolean => {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:') return false;
  if (url.username || url.password) return false;
  const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
  if (!hostname || isIpLiteral(hostname)) return false;
  if (hostname === 'localhost' || !hostname.includes('.')) return false;
  return !PRIVATE_SUFFIXES.some((suffix) => hostname.endsWith(suffix));
};

const readCapped = async (response: Response, maxBytes: number): Promise<string | null> => {
  const declared = Number(response.headers.get('content-length') ?? '');
  if (Number.isFinite(declared) && declared > maxBytes) return null;
  if (!response.body) return '';

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
};

export type FetchJsonDocumentOptions = {
  maxBytes?: number;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
};

/** The parsed JSON, or null when the URL is unsafe or the fetch fails in any way. */
export const fetchJsonDocument = async (
  url: string,
  options: FetchJsonDocumentOptions = {},
): Promise<unknown | null> => {
  const maxBytes = options.maxBytes ?? DOCUMENT_MAX_BYTES;
  const fetchFn = options.fetchImpl ?? fetch;
  if (!isSafeDocumentUrl(url)) return null;

  const signal = AbortSignal.timeout(options.timeoutMs ?? DOCUMENT_TIMEOUT_MS);
  const get = (target: string) =>
    fetchFn(target, {
      headers: { Accept: 'application/json' },
      redirect: 'manual',
      signal,
    });

  try {
    let response = await get(url);
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) return null;
      const next = new URL(location, url);
      if (next.host !== new URL(url).host || !isSafeDocumentUrl(next.toString())) {
        return null;
      }
      response = await get(next.toString());
      if (response.status >= 300 && response.status < 400) return null;
    }
    if (!response.ok) return null;

    const text = await readCapped(response, maxBytes);
    if (text == null) return null;
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
};
