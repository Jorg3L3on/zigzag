import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  getOwnedConnection,
  listMcpToolCalls,
  parseConnectionKind,
} from '@/lib/mcp/activity';

/**
 * Agent activity of one of the session user's connections (ZIG-I23-8):
 * `?kind=api_key|oauth_grant&id=<id>[&cursor=<last id>][&limit=20]`.
 * A connection of another user answers 404, like one that does not exist.
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  const userId = BigInt(session.user.id);

  const params = request.nextUrl.searchParams;
  const kind = parseConnectionKind(params.get('kind'));
  const connectionId = Number(params.get('id'));
  const cursorParam = params.get('cursor');
  const cursor = cursorParam ? Number(cursorParam) : null;
  const limit = Number(params.get('limit') ?? 20);
  if (
    !kind ||
    (cursor != null && (!Number.isInteger(cursor) || cursor <= 0)) ||
    !Number.isInteger(limit)
  ) {
    return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 });
  }

  try {
    const connection = await getOwnedConnection(userId, kind, connectionId);
    if (!connection) {
      return NextResponse.json({ error: 'Conexión no encontrada' }, { status: 404 });
    }
    const page = await listMcpToolCalls({ userId, kind, connectionId, cursor, limit });
    return NextResponse.json(page);
  } catch (error) {
    console.error('Error listing MCP activity:', error);
    return NextResponse.json(
      { error: 'No se pudo cargar la actividad' },
      { status: 500 },
    );
  }
}
