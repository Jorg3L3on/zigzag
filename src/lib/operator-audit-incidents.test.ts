import {
  isOperatorIncidentEvent,
  operatorIncidentLabel,
} from '@/lib/operator-audit-incidents';

describe('operator alert-type events', () => {
  it('flags failed sign-ins and permission denials', () => {
    expect(
      isOperatorIncidentEvent({ action: 'sign_in_failed', result: 'failed', resource_type: 'auth' }),
    ).toBe(true);
    expect(
      isOperatorIncidentEvent({ action: 'permission_denied', result: 'denied', resource_type: 'security' }),
    ).toBe(true);
    expect(
      operatorIncidentLabel({ action: 'sign_in_failed', result: 'failed', resource_type: 'auth' }),
    ).toBe('Inicio de sesión fallido');
  });

  it('no longer reads the payload text (E12)', () => {
    expect(
      isOperatorIncidentEvent({
        action: 'updated',
        result: 'success',
        resource_type: 'ticket',
        payload: { errorCode: 'CO011', message: 'Límite del plan' },
      }),
    ).toBe(false);
  });

  it('ignores routine events', () => {
    expect(
      isOperatorIncidentEvent({ action: 'signed_in', result: 'success', resource_type: 'auth' }),
    ).toBe(false);
  });
});
