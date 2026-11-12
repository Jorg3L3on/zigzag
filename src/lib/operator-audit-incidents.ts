export type OperatorAuditEventLike = {
  action: string;
  result: string;
  resource_type: string;
  payload?: Record<string, unknown> | null;
};

/**
 * Events that can feed a security alert (ZIG-I38): failed sign-ins and denied
 * permissions. A single one is shown as an alert-type event in Actividad, but
 * the fleet only raises an alert on a burst (see operator-sign-in-burst.ts).
 * «Límite de plan» is no longer detected by searching the payload text (E12).
 */
export const isOperatorIncidentEvent = (
  event: OperatorAuditEventLike,
): boolean => {
  if (event.action === 'sign_in_failed') {
    return true;
  }
  if (event.action === 'permission_denied') {
    return true;
  }
  if (event.resource_type === 'auth' && event.result === 'failed') {
    return true;
  }
  if (event.resource_type === 'security' && event.result === 'denied') {
    return true;
  }
  return false;
};

export const operatorIncidentLabel = (
  event: OperatorAuditEventLike,
): string => {
  if (
    event.action === 'sign_in_failed' ||
    (event.resource_type === 'auth' && event.result === 'failed')
  ) {
    return 'Inicio de sesión fallido';
  }
  if (event.action === 'permission_denied' || event.resource_type === 'security') {
    return 'Permiso denegado';
  }
  return 'Alerta';
};
