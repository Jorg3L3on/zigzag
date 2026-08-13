import {
  buildAuditRequestMeta,
  buildAuditRequestMetaFromRequest,
  getClientIpFromHeaders,
  mergeAuditRequestMeta,
} from '@/lib/audit-request-meta';

describe('audit-request-meta', () => {
  it('builds compact meta and omits empty fields', () => {
    expect(
      buildAuditRequestMeta({
        ip: ' 1.2.3.4 ',
        userAgent: 'Mozilla/5.0',
        route: '/login',
        method: 'post',
        requestId: 'req-12345-abcdef',
      }),
    ).toEqual({
      ip: '1.2.3.4',
      userAgent: 'Mozilla/5.0',
      route: '/login',
      method: 'POST',
      requestId: 'req-12345-abcdef',
    });

    expect(buildAuditRequestMeta({ ip: '  ', userAgent: null })).toBeUndefined();
  });

  it('reads client IP from forwarded headers', () => {
    const headers = new Headers({
      'x-forwarded-for': '10.0.0.1, 10.0.0.2',
    });
    expect(getClientIpFromHeaders(headers)).toBe('10.0.0.1');
  });

  it('builds meta from a Request-like object', () => {
    const headers = new Headers({
      'user-agent': 'JestAgent/1.0',
      'x-real-ip': '9.9.9.9',
      'x-request-id': 'req-abcdef12',
    });

    expect(
      buildAuditRequestMetaFromRequest({
        headers,
        method: 'PATCH',
        url: 'https://example.com/api/tickets/1',
      }),
    ).toEqual({
      ip: '9.9.9.9',
      userAgent: 'JestAgent/1.0',
      route: '/api/tickets/1',
      method: 'PATCH',
      requestId: 'req-abcdef12',
    });
  });

  it('merges meta with later parts winning', () => {
    expect(
      mergeAuditRequestMeta(
        { ip: '1.1.1.1', route: '/a' },
        { route: '/b', method: 'GET' },
        null,
      ),
    ).toEqual({
      ip: '1.1.1.1',
      route: '/b',
      method: 'GET',
    });
  });
});
