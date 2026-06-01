import {
  formatAuditResourceLabel,
  redactAuditDisplayValue,
  resolveAuditResourceLink,
} from '@/lib/audit-display';

describe('audit display helpers', () => {
  it('recursively redacts sensitive-looking keys', () => {
    const redacted = redactAuditDisplayValue({
      email: 'user@example.com',
      password: 'secret',
      api_key: 'key-value',
      nested: {
        Authorization: 'Bearer token',
        rememberToken: 'remember-me',
        safe: 'visible',
      },
      list: [
        {
          cookie: 'session=abc',
          value: 3,
        },
      ],
    });

    expect(redacted).toEqual({
      email: 'user@example.com',
      password: '[REDACTED]',
      api_key: '[REDACTED]',
      nested: {
        Authorization: '[REDACTED]',
        rememberToken: '[REDACTED]',
        safe: 'visible',
      },
      list: [
        {
          cookie: '[REDACTED]',
          value: 3,
        },
      ],
    });
  });

  it('resolves links only for safe dashboard resource destinations', () => {
    expect(resolveAuditResourceLink('ticket', '123')).toEqual({
      href: '/dashboard/tickets/123',
      label: 'ticket#123',
    });
    expect(resolveAuditResourceLink('client', '9')).toEqual({
      href: '/dashboard/clients/9/edit',
      label: 'client#9',
    });
    expect(resolveAuditResourceLink('service', '5')).toEqual({
      href: '/dashboard/services/5/edit',
      label: 'service#5',
    });
    expect(resolveAuditResourceLink('company', '2')).toEqual({
      href: '/dashboard/companies/2/edit',
      label: 'company#2',
    });
  });

  it('leaves unsafe or unsupported resources as plain labels', () => {
    expect(resolveAuditResourceLink('security', 'tickets.write')).toBeNull();
    expect(resolveAuditResourceLink('ticket', '../1')).toBeNull();
    expect(resolveAuditResourceLink('ticket', null)).toBeNull();
    expect(formatAuditResourceLabel('security', 'tickets.write')).toBe(
      'security#tickets.write',
    );
  });
});
