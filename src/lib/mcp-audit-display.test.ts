import { formatAuditEventSummary } from '@/lib/audit-event-summary';
import { formatMcpAgentDetail } from '@/lib/mcp-audit-display';
import { formatTicketTimelineEntry } from '@/lib/ticket-audit-display';

const mcpPayload = {
  ticket: { client_name: 'Ana Pérez' },
  source: 'mcp',
  mcp: {
    tool: 'create_document',
    connection: { kind: 'api_key', id: 3, name: 'Cursor de Jorge' },
  },
};

describe('formatMcpAgentDetail (ZIG-I23-6)', () => {
  it('names the tool and the connection', () => {
    expect(formatMcpAgentDetail(mcpPayload)).toBe(
      'Agente MCP: create_document · Cursor de Jorge (llave de agente)',
    );
    expect(
      formatMcpAgentDetail({
        mcp: { tool: 'update_client', connection: { kind: 'oauth_grant', id: 2, name: null } },
      }),
    ).toBe('Agente MCP: update_client · conexión OAuth');
  });

  it('is null for writes made in the app', () => {
    expect(formatMcpAgentDetail({ source: 'composer' })).toBeNull();
    expect(formatMcpAgentDetail(null)).toBeNull();
  });

  it('shows in Auditoría and in the ticket history', () => {
    const summary = formatAuditEventSummary({
      actor_name: 'Ana Administradora',
      resource_type: 'ticket',
      resource_id: '42',
      action: 'created',
      result: 'success',
      payload: mcpPayload,
    });
    expect(summary.details[0]).toBe('Agente MCP: create_document · Cursor de Jorge (llave de agente)');

    const timeline = formatTicketTimelineEntry({
      eventType: 'created',
      actorName: 'Ana Administradora',
      payload: mcpPayload,
    });
    expect(timeline.details).toEqual([
      'Agente MCP: create_document · Cursor de Jorge (llave de agente)',
    ]);
  });
});
