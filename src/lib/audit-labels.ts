import type { AuditAction, AuditResourceType, AuditResult } from '@/lib/audit-catalog';

const ACTION_LABELS: Record<AuditAction, string> = {
  signed_in: 'Inicio de sesión',
  signed_out: 'Cierre de sesión',
  sign_in_failed: 'Inicio de sesión fallido',
  created: 'Creación',
  updated: 'Actualización',
  deleted: 'Eliminación',
  finished: 'Finalización',
  payment_collected: 'Cobro registrado',
  presupuesto_converted: 'Presupuesto convertido',
  presupuesto_canceled: 'Presupuesto cancelado',
  logo_uploaded: 'Logo subido',
  logo_removed: 'Logo eliminado',
  permissions_changed: 'Permisos modificados',
  permission_assigned: 'Permiso asignado',
  permission_removed: 'Permiso eliminado',
  export_generated: 'Exportación generada',
  offboarded: 'Baja de empresa',
  generated: 'Generación',
  permission_denied: 'Permiso denegado',
};

const RESULT_LABELS: Record<AuditResult, string> = {
  success: 'Éxito',
  denied: 'Denegado',
  failed: 'Fallido',
};

const RESOURCE_TYPE_LABELS: Record<AuditResourceType, string> = {
  auth: 'Sesión',
  ticket: 'Ticket',
  client: 'Cliente',
  service: 'Servicio',
  company: 'Empresa',
  user: 'Usuario',
  role: 'Rol',
  permission: 'Permiso',
  invoice: 'Recibo',
  export: 'Exportación',
  report: 'Reporte',
  security: 'Seguridad',
};

export const formatAuditActionLabel = (action: string): string =>
  ACTION_LABELS[action as AuditAction] ?? action;

export const formatAuditResultLabel = (result: string): string =>
  RESULT_LABELS[result as AuditResult] ?? result;

export const formatAuditResourceTypeLabel = (resourceType: string): string =>
  RESOURCE_TYPE_LABELS[resourceType as AuditResourceType] ?? resourceType;
