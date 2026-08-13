export type OperatorAuditEventLike = {
  action: string;
  result: string;
  resource_type: string;
  payload?: Record<string, unknown> | null;
};

const payloadMentionsEntitlementLimit = (
  payload: Record<string, unknown> | null | undefined,
): boolean => {
  const serialized = JSON.stringify(payload ?? {}).toLowerCase();
  return (
    serialized.includes('co011') ||
    serialized.includes('límite del plan') ||
    serialized.includes('limite del plan') ||
    serialized.includes('plan limit')
  );
};

export const isOperatorIncidentEvent = (
  event: OperatorAuditEventLike,
): boolean => {
  if (event.action === 'sign_in_failed') {
    return true;
  }
  if (event.action === 'permission_denied') {
    return true;
  }
  if (event.resource_type === 'auth' && event.result !== 'success') {
    return true;
  }
  if (event.resource_type === 'security' && event.result === 'denied') {
    return true;
  }
  if (payloadMentionsEntitlementLimit(event.payload)) {
    return true;
  }
  return false;
};

export const operatorIncidentLabel = (
  event: OperatorAuditEventLike,
): string => {
  if (
    event.action === 'sign_in_failed' ||
    (event.resource_type === 'auth' && event.result !== 'success')
  ) {
    return 'Inicio de sesión fallido';
  }
  if (event.action === 'permission_denied' || event.resource_type === 'security') {
    return 'Permiso denegado';
  }
  if (payloadMentionsEntitlementLimit(event.payload)) {
    return 'Límite de plan';
  }
  return 'Incidente operativo';
};
