/**
 * Audit payloads of MCP writes carry `mcp: { tool, connection }` (ZIG-I23-6).
 * This turns it into the line Auditoría and the ticket's Historial show, so a
 * person can tell a change came from an agent and through which connection.
 */
const asRecord = (value: unknown): Record<string, unknown> | null =>
  value != null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const CONNECTION_KIND_LABEL: Record<string, string> = {
  api_key: 'llave de agente',
  oauth_grant: 'conexión OAuth',
};

export const formatMcpAgentDetail = (
  payload: Record<string, unknown> | null | undefined,
): string | null => {
  const mcp = asRecord(payload?.mcp);
  const tool = typeof mcp?.tool === 'string' ? mcp.tool : null;
  if (!tool) return null;
  const connection = asRecord(mcp?.connection);
  const kind = typeof connection?.kind === 'string' ? connection.kind : '';
  const kindLabel = CONNECTION_KIND_LABEL[kind] ?? 'conexión';
  const name = typeof connection?.name === 'string' ? connection.name.trim() : '';
  return `Agente MCP: ${tool} · ${name ? `${name} (${kindLabel})` : kindLabel}`;
};
