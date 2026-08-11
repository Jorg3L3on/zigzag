export const EXPIRED_SESSION_REASON = 'expired';
export const LOGIN_PATH = '/login';

const getFirstParamValue = (value: unknown): string | null => {
  if (Array.isArray(value)) {
    return getFirstParamValue(value[0]);
  }
  return typeof value === 'string' ? value : null;
};

export const isExpiredSessionReason = (reason: unknown) =>
  getFirstParamValue(reason) === EXPIRED_SESSION_REASON;

export const getSafeAppRedirectPath = (callbackUrl: unknown): string | null => {
  const rawValue = getFirstParamValue(callbackUrl)?.trim();

  if (!rawValue || !rawValue.startsWith('/') || rawValue.startsWith('//')) {
    return null;
  }

  try {
    const url = new URL(rawValue, 'https://zigzag.local');

    if (url.origin !== 'https://zigzag.local' || url.pathname === LOGIN_PATH) {
      return null;
    }

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
};

export const getExpiredLoginPath = (callbackPath?: string) => {
  const params = new URLSearchParams({ reason: EXPIRED_SESSION_REASON });
  const safeCallbackPath = getSafeAppRedirectPath(callbackPath);

  if (safeCallbackPath) {
    params.set('callbackUrl', safeCallbackPath);
  }

  return `${LOGIN_PATH}?${params.toString()}`;
};

export const buildExpiredLoginUrl = (requestUrl: URL, callbackPath?: string) => {
  return new URL(getExpiredLoginPath(callbackPath), requestUrl);
};
