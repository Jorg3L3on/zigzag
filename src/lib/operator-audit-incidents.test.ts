import {
  isOperatorIncidentEvent,
  operatorIncidentLabel,
} from '@/lib/operator-audit-incidents';

describe('operator audit incidents', () => {
  it('flags failed logins and permission denials', () => {
    expect(
      isOperatorIncidentEvent({
        action: 'sign_in_failed',
        result: 'failed',
        resource_type: 'auth',
      }),
    ).toBe(true);
    expect(
      isOperatorIncidentEvent({
        action: 'permission_denied',
        result: 'denied',
        resource_type: 'security',
      }),
    ).toBe(true);
    expect(
      operatorIncidentLabel({
        action: 'permission_denied',
        result: 'denied',
        resource_type: 'security',
      }),
    ).toBe('Permiso denegado');
  });

  it('flags entitlement limit denials from payload metadata', () => {
    const event = {
      action: 'updated',
      result: 'denied',
      resource_type: 'ticket',
      payload: { errorCode: 'CO011', message: 'Límite del plan Starter alcanzado' },
    };
    expect(isOperatorIncidentEvent(event)).toBe(true);
    expect(operatorIncidentLabel(event)).toBe('Límite de plan');
  });

  it('ignores routine successful audit events', () => {
    expect(
      isOperatorIncidentEvent({
        action: 'updated',
        result: 'success',
        resource_type: 'client',
      }),
    ).toBe(false);
  });
});
