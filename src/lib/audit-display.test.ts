import {
  formatAuditResourceLabel,
  redactAuditDisplayValue,
  resolveAuditResourceLink,
  resolveAuditSummaryResourcePresentation,
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
      href: '/tickets/123',
      label: 'Ticket #123',
    });
    expect(resolveAuditResourceLink('invoice', '123')).toEqual({
      href: '/tickets/123',
      label: 'Recibo · Ticket #123',
    });
    expect(resolveAuditResourceLink('client', '9')).toEqual({
      href: '/clients/9/edit',
      label: 'Cliente #9',
    });
    expect(resolveAuditResourceLink('service', '5')).toEqual({
      href: '/services/5/edit',
      label: 'Servicio #5',
    });
    expect(resolveAuditResourceLink('company', '2')).toEqual({
      href: '/companies/2/edit',
      label: 'Empresa #2',
    });
    expect(resolveAuditResourceLink('user', '7')).toEqual({
      href: '/users',
      label: 'Usuario #7',
    });
  });

  it('leaves unsafe or unsupported resources as plain labels', () => {
    expect(resolveAuditResourceLink('security', 'tickets.write')).toBeNull();
    expect(resolveAuditResourceLink('ticket', '../1')).toBeNull();
    expect(resolveAuditResourceLink('ticket', null)).toBeNull();
    expect(formatAuditResourceLabel('security', 'tickets.write')).toBe(
      'Seguridad · tickets.write',
    );
    expect(formatAuditResourceLabel('auth', '10', { actorName: 'Ana' })).toBe(
      'Sesión · Ana',
    );
    expect(formatAuditResourceLabel('auth', 'user@example.com')).toBe(
      'Sesión · user@example.com',
    );
  });

  it('includes payload display names in resource labels', () => {
    expect(
      formatAuditResourceLabel('ticket', '12', { displayName: 'Acme' }),
    ).toBe('Ticket #12 · Acme');
    expect(
      formatAuditResourceLabel('client', '9', { displayName: 'Acme' }),
    ).toBe('Cliente #9 · Acme');
  });

  it('hides redundant Resumen subtitles when the title already has the ticket id', () => {
    const presentation = resolveAuditSummaryResourcePresentation({
      title: 'Chano generó el recibo del ticket #1062',
      resourceType: 'invoice',
      resourceId: '1062',
      payload: null,
    });

    expect(presentation.subtitle).toBeNull();
    expect(presentation.linkTitle).toBe(true);
    expect(presentation.href).toBe('/tickets/1062');
  });

  it('keeps a client-name subtitle when the title only has the ticket id', () => {
    const presentation = resolveAuditSummaryResourcePresentation({
      title: 'Chano actualizó el ticket #1065',
      resourceType: 'ticket',
      resourceId: '1065',
      payload: { after: { client_name: 'Acme' } },
    });

    expect(presentation.subtitle).toBe('Cliente · Acme');
    expect(presentation.linkTitle).toBe(false);
    expect(presentation.href).toBe('/tickets/1065');
  });
});
