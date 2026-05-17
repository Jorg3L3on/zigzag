import type { ActionErrorType } from '@/lib/errors';

export type ErrorModule =
  | 'auth'
  | 'clients'
  | 'companies'
  | 'dashboard'
  | 'generic'
  | 'pdf'
  | 'permissions'
  | 'roles'
  | 'services'
  | 'ticket-services'
  | 'tickets'
  | 'users';

export type ErrorCatalogEntry = {
  code: string;
  module: ErrorModule;
  title: string;
  message: string;
  type: ActionErrorType;
};

export const ERROR_CATALOG = {
  AU001: {
    code: 'AU001',
    module: 'auth',
    title: 'Sesión requerida',
    message: 'Inicia sesión para continuar.',
    type: 'auth',
  },
  AU002: {
    code: 'AU002',
    module: 'auth',
    title: 'Acceso denegado',
    message: 'No tienes permisos para realizar esta acción.',
    type: 'auth',
  },
  CL001: {
    code: 'CL001',
    module: 'clients',
    title: 'No se pudieron cargar los clientes',
    message: 'Intenta de nuevo en unos momentos.',
    type: 'server',
  },
  CL002: {
    code: 'CL002',
    module: 'clients',
    title: 'No se pudo cargar el cliente',
    message: 'Verifica que el cliente exista e intenta de nuevo.',
    type: 'server',
  },
  CL003: {
    code: 'CL003',
    module: 'clients',
    title: 'No se pudo crear el cliente',
    message: 'Revisa la información del cliente e intenta de nuevo.',
    type: 'server',
  },
  CL004: {
    code: 'CL004',
    module: 'clients',
    title: 'No se pudo actualizar el cliente',
    message: 'Revisa la información del cliente e intenta de nuevo.',
    type: 'server',
  },
  CL005: {
    code: 'CL005',
    module: 'clients',
    title: 'No se pudo eliminar el cliente',
    message: 'Intenta de nuevo en unos momentos.',
    type: 'server',
  },
  CL006: {
    code: 'CL006',
    module: 'clients',
    title: 'Cliente no encontrado',
    message: 'El cliente solicitado no existe o ya no está disponible.',
    type: 'validation',
  },
  CL007: {
    code: 'CL007',
    module: 'clients',
    title: 'Datos del cliente incompletos',
    message: 'Completa los campos requeridos e intenta de nuevo.',
    type: 'validation',
  },
  CO001: {
    code: 'CO001',
    module: 'companies',
    title: 'No se pudieron cargar las empresas',
    message: 'Intenta de nuevo en unos momentos.',
    type: 'server',
  },
  CO002: {
    code: 'CO002',
    module: 'companies',
    title: 'No se pudo cargar la empresa',
    message: 'Verifica que la empresa exista e intenta de nuevo.',
    type: 'server',
  },
  CO003: {
    code: 'CO003',
    module: 'companies',
    title: 'No se pudo crear la empresa',
    message: 'Revisa la información de la empresa e intenta de nuevo.',
    type: 'server',
  },
  CO004: {
    code: 'CO004',
    module: 'companies',
    title: 'No se pudo actualizar la empresa',
    message: 'Revisa la información de la empresa e intenta de nuevo.',
    type: 'server',
  },
  CO005: {
    code: 'CO005',
    module: 'companies',
    title: 'No se pudo eliminar la empresa',
    message: 'Intenta de nuevo en unos momentos.',
    type: 'server',
  },
  CO006: {
    code: 'CO006',
    module: 'companies',
    title: 'Empresa no encontrada',
    message: 'La empresa solicitada no existe o ya no está disponible.',
    type: 'validation',
  },
  CO007: {
    code: 'CO007',
    module: 'companies',
    title: 'Datos de la empresa inválidos',
    message: 'Revisa los campos marcados e intenta de nuevo.',
    type: 'validation',
  },
  DB001: {
    code: 'DB001',
    module: 'dashboard',
    title: 'No se pudo cargar el dashboard',
    message: 'Intenta de nuevo en unos momentos.',
    type: 'server',
  },
  GN001: {
    code: 'GN001',
    module: 'generic',
    title: 'No se pudo completar la operación',
    message: 'Intenta de nuevo en unos momentos.',
    type: 'unknown',
  },
  GN002: {
    code: 'GN002',
    module: 'generic',
    title: 'Sin conexión',
    message: 'Verifica tu conexión a internet e intenta de nuevo.',
    type: 'network',
  },
  GN003: {
    code: 'GN003',
    module: 'generic',
    title: 'Datos inválidos',
    message: 'Revisa los campos marcados e intenta de nuevo.',
    type: 'validation',
  },
  PDF001: {
    code: 'PDF001',
    module: 'pdf',
    title: 'No se pudo generar el PDF',
    message: 'Intenta de nuevo en unos momentos.',
    type: 'server',
  },
  PDF002: {
    code: 'PDF002',
    module: 'pdf',
    title: 'No se pudo descargar el PDF',
    message: 'Intenta de nuevo en unos momentos.',
    type: 'server',
  },
  PM001: {
    code: 'PM001',
    module: 'permissions',
    title: 'No se pudieron cargar los permisos',
    message: 'Intenta de nuevo en unos momentos.',
    type: 'server',
  },
  PM002: {
    code: 'PM002',
    module: 'permissions',
    title: 'No se pudo crear el permiso',
    message: 'Revisa la información del permiso e intenta de nuevo.',
    type: 'server',
  },
  PM003: {
    code: 'PM003',
    module: 'permissions',
    title: 'No se pudo actualizar el permiso',
    message: 'Revisa la información del permiso e intenta de nuevo.',
    type: 'server',
  },
  PM004: {
    code: 'PM004',
    module: 'permissions',
    title: 'No se pudo eliminar el permiso',
    message: 'Intenta de nuevo en unos momentos.',
    type: 'server',
  },
  PM005: {
    code: 'PM005',
    module: 'permissions',
    title: 'No se pudo asignar el permiso',
    message: 'Verifica que el rol y el permiso estén disponibles.',
    type: 'server',
  },
  PM006: {
    code: 'PM006',
    module: 'permissions',
    title: 'No se pudo remover el permiso',
    message: 'Intenta de nuevo en unos momentos.',
    type: 'server',
  },
  RL001: {
    code: 'RL001',
    module: 'roles',
    title: 'No se pudieron cargar los roles',
    message: 'Intenta de nuevo en unos momentos.',
    type: 'server',
  },
  RL002: {
    code: 'RL002',
    module: 'roles',
    title: 'No se pudo crear el rol',
    message: 'Revisa la información del rol e intenta de nuevo.',
    type: 'server',
  },
  RL003: {
    code: 'RL003',
    module: 'roles',
    title: 'No se pudo actualizar el rol',
    message: 'Revisa la información del rol e intenta de nuevo.',
    type: 'server',
  },
  RL004: {
    code: 'RL004',
    module: 'roles',
    title: 'No se pudo eliminar el rol',
    message: 'Intenta de nuevo en unos momentos.',
    type: 'server',
  },
  SV001: {
    code: 'SV001',
    module: 'services',
    title: 'No se pudieron cargar los servicios',
    message: 'Intenta de nuevo en unos momentos.',
    type: 'server',
  },
  SV002: {
    code: 'SV002',
    module: 'services',
    title: 'No se pudo crear el servicio',
    message: 'Revisa la información del servicio e intenta de nuevo.',
    type: 'server',
  },
  SV003: {
    code: 'SV003',
    module: 'services',
    title: 'No se pudo actualizar el servicio',
    message: 'Revisa la información del servicio e intenta de nuevo.',
    type: 'server',
  },
  SV004: {
    code: 'SV004',
    module: 'services',
    title: 'No se pudo eliminar el servicio',
    message: 'Intenta de nuevo en unos momentos.',
    type: 'server',
  },
  TC001: {
    code: 'TC001',
    module: 'tickets',
    title: 'No se pudo crear el ticket',
    message: 'Revisa la información del ticket e intenta de nuevo.',
    type: 'server',
  },
  TC002: {
    code: 'TC002',
    module: 'tickets',
    title: 'No se pudieron cargar los tickets',
    message: 'Intenta de nuevo en unos momentos.',
    type: 'server',
  },
  TC003: {
    code: 'TC003',
    module: 'tickets',
    title: 'No se pudo cargar el ticket',
    message: 'Verifica que el ticket exista e intenta de nuevo.',
    type: 'server',
  },
  TC004: {
    code: 'TC004',
    module: 'tickets',
    title: 'No se pudo actualizar el ticket',
    message: 'Revisa la información del ticket e intenta de nuevo.',
    type: 'server',
  },
  TC005: {
    code: 'TC005',
    module: 'tickets',
    title: 'No se pudo eliminar el ticket',
    message: 'Intenta de nuevo en unos momentos.',
    type: 'server',
  },
  TC006: {
    code: 'TC006',
    module: 'tickets',
    title: 'No se pudo finalizar el ticket',
    message: 'Verifica el estado del ticket e intenta de nuevo.',
    type: 'server',
  },
  TC007: {
    code: 'TC007',
    module: 'tickets',
    title: 'No se pudo registrar el cobro',
    message: 'Revisa el monto e intenta de nuevo.',
    type: 'server',
  },
  TC008: {
    code: 'TC008',
    module: 'tickets',
    title: 'Ticket no encontrado',
    message: 'El ticket solicitado no existe o ya no está disponible.',
    type: 'validation',
  },
  TC009: {
    code: 'TC009',
    module: 'tickets',
    title: 'Datos del ticket inválidos',
    message: 'Revisa los campos marcados e intenta de nuevo.',
    type: 'validation',
  },
  TS001: {
    code: 'TS001',
    module: 'ticket-services',
    title: 'No se pudieron cargar los servicios del ticket',
    message: 'Intenta de nuevo en unos momentos.',
    type: 'server',
  },
  TS002: {
    code: 'TS002',
    module: 'ticket-services',
    title: 'No se pudo agregar el servicio',
    message: 'Verifica el servicio seleccionado e intenta de nuevo.',
    type: 'server',
  },
  TS003: {
    code: 'TS003',
    module: 'ticket-services',
    title: 'No se pudo actualizar el servicio',
    message: 'Revisa la información del servicio e intenta de nuevo.',
    type: 'server',
  },
  TS004: {
    code: 'TS004',
    module: 'ticket-services',
    title: 'No se pudo eliminar el servicio',
    message: 'Intenta de nuevo en unos momentos.',
    type: 'server',
  },
  TS005: {
    code: 'TS005',
    module: 'ticket-services',
    title: 'Servicio del ticket no encontrado',
    message: 'El servicio solicitado no existe o ya no está disponible.',
    type: 'validation',
  },
  US001: {
    code: 'US001',
    module: 'users',
    title: 'No se pudieron cargar los usuarios',
    message: 'Intenta de nuevo en unos momentos.',
    type: 'server',
  },
  US002: {
    code: 'US002',
    module: 'users',
    title: 'No se pudo crear el usuario',
    message: 'Revisa la información del usuario e intenta de nuevo.',
    type: 'server',
  },
  US003: {
    code: 'US003',
    module: 'users',
    title: 'No se pudo actualizar el usuario',
    message: 'Revisa la información del usuario e intenta de nuevo.',
    type: 'server',
  },
  US004: {
    code: 'US004',
    module: 'users',
    title: 'No se pudo eliminar el usuario',
    message: 'Intenta de nuevo en unos momentos.',
    type: 'server',
  },
  US005: {
    code: 'US005',
    module: 'users',
    title: 'Datos del usuario inválidos',
    message: 'Revisa los campos marcados e intenta de nuevo.',
    type: 'validation',
  },
} as const satisfies Record<string, ErrorCatalogEntry>;

export type ErrorCode = keyof typeof ERROR_CATALOG;

export type PublicErrorPayload = {
  error: string;
  errorCode: ErrorCode;
  errorTitle: string;
  errorType: ActionErrorType;
};

export function getErrorCatalogEntry(code: ErrorCode): ErrorCatalogEntry {
  return ERROR_CATALOG[code];
}

export function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === 'string' && value in ERROR_CATALOG;
}
