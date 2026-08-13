import { formatAuditEventSummary } from '@/lib/audit-event-summary';

describe('formatAuditEventSummary', () => {
  it('summarizes successful sign-in events in Spanish', () => {
    expect(
      formatAuditEventSummary({
        actor_name: 'Jorge',
        resource_type: 'auth',
        resource_id: '2',
        action: 'signed_in',
        result: 'success',
        payload: { email: 'jorge@jorge.com' },
      }),
    ).toEqual({
      title: 'Jorge inició sesión',
      details: ['Correo: jorge@jorge.com'],
    });
  });

  it('summarizes failed sign-in with reason and email', () => {
    const summary = formatAuditEventSummary({
      actor_name: null,
      resource_type: 'auth',
      resource_id: 'user@example.com',
      action: 'sign_in_failed',
      result: 'failed',
      payload: { email: 'user@example.com', reason: 'throttled' },
    });

    expect(summary.title).toContain('Inicio de sesión fallido');
    expect(summary.title).toContain('demasiados intentos');
    expect(summary.title).toContain('user@example.com');
  });

  it('summarizes permission denials with permission code', () => {
    expect(
      formatAuditEventSummary({
        actor_name: 'Ana',
        resource_type: 'security',
        resource_id: 'clients.write',
        action: 'permission_denied',
        result: 'denied',
        payload: {
          permission: 'clients.write',
          denial_reason: 'missing_permission',
          error_code: 'AU002',
        },
      }),
    ).toEqual({
      title: 'Denegado: clients.write',
      details: ['Motivo: falta el permiso', 'Código: AU002'],
    });
  });

  it('summarizes ticket payments with amount', () => {
    const summary = formatAuditEventSummary({
      actor_name: 'Ana',
      resource_type: 'ticket',
      resource_id: '12',
      action: 'payment_collected',
      result: 'success',
      payload: {
        payment: { appliedAmount: 500 },
      },
    });

    expect(summary.title).toContain('Ana registró un pago');
    expect(summary.title).toContain('ticket #12');
  });

  it('summarizes client updates with resource name', () => {
    expect(
      formatAuditEventSummary({
        actor_name: 'Luis',
        resource_type: 'client',
        resource_id: '9',
        action: 'updated',
        result: 'success',
        payload: { after: { name: 'Acme' } },
      }),
    ).toEqual({
      title: 'Luis actualizó el cliente "Acme"',
      details: [],
    });
  });

  it('includes ticket field diffs in details for updates', () => {
    const summary = formatAuditEventSummary({
      actor_name: 'Ana',
      resource_type: 'ticket',
      resource_id: '3',
      action: 'updated',
      result: 'success',
      payload: {
        before: { client_name: 'A', total: 10 },
        after: { client_name: 'B', total: 20 },
      },
    });

    expect(summary.title).toBe(
      'Ana actualizó el ticket #3 (Cliente "B")',
    );
    expect(summary.details.some((line) => line.includes('cliente:'))).toBe(true);
  });

  it('includes client name in ticket create titles', () => {
    expect(
      formatAuditEventSummary({
        actor_name: 'Chano',
        resource_type: 'ticket',
        resource_id: '1065',
        action: 'created',
        result: 'success',
        payload: { ticket: { client_name: 'Acme' } },
      }),
    ).toEqual({
      title: 'Chano creó el ticket #1065 (Cliente "Acme")',
      details: [],
    });
  });
});
