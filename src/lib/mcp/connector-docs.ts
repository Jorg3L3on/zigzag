import { headers } from 'next/headers';
import { getMcpResourceUrl } from '@/lib/server/mcp-oauth/config';

/**
 * Used by the public connector page (/ayuda/asistentes; the old
 * /docs/mcp-connector redirects there): what each scope allows, and the
 * connector URL on the host the page was opened on.
 */

/** Every scope a connection can hold; rows render only for scopes the server grants. */
export const MCP_SCOPE_DESCRIPTIONS: Record<string, string> = {
  read: 'Leer compañías, documentos (presupuestos, tickets, recibos), clientes, catálogo y buscar. Siempre incluido.',
  write:
    'Crear y editar documentos y clientes, convertir presupuestos y cambiar estados. Solo si lo marcas al autorizar.',
  payments:
    'Registrar cobros en tickets terminados (register_payment) y crear tickets ya pagados. Apagado por defecto; se concede aparte de la escritura y nunca se agrega a una conexión existente. Sin reembolsos ni borrado de pagos.',
};

/** The connector URL on the request host (falls back to the configured issuer). */
export const requestMcpUrl = async (): Promise<string> => {
  const headerStore = await headers();
  const host = headerStore.get('x-forwarded-host') ?? headerStore.get('host');
  if (!host) return getMcpResourceUrl();
  const proto =
    headerStore.get('x-forwarded-proto') ??
    (host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https');
  return `${proto}://${host}/api/mcp`;
};
