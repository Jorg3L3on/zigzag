import { and, eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { mcpOAuthGrant } from '@/db/schema';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { updateOAuthGrantAllowList } from '@/lib/server/mcp-oauth/grants';
import { updateOAuthGrantSchema } from '@/schemas/api-key.schema';

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  const userId = BigInt(session.user.id);
  const { id } = await context.params;
  const grantId = Number(id);
  if (!Number.isInteger(grantId) || grantId <= 0) {
    return NextResponse.json({ error: 'Id inválido' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const input = updateOAuthGrantSchema.parse(body);
    const ok = await updateOAuthGrantAllowList(
      grantId,
      userId,
      input.allowed_company_ids,
    );
    if (!ok) {
      return NextResponse.json({ error: 'Conexión no encontrada' }, { status: 404 });
    }
    const grant = await db.query.mcpOAuthGrant.findFirst({
      where: eq(mcpOAuthGrant.id, grantId),
    });
    return NextResponse.json({
      id: grant!.id,
      allowed_company_ids: grant!.allowed_company_ids,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Error de validación', details: error.issues },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: 'No se pudo actualizar' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  const userId = BigInt(session.user.id);
  const { id } = await context.params;
  const grantId = Number(id);
  if (!Number.isInteger(grantId) || grantId <= 0) {
    return NextResponse.json({ error: 'Id inválido' }, { status: 400 });
  }

  const result = await db
    .update(mcpOAuthGrant)
    .set({ revoked_at: new Date() })
    .where(and(eq(mcpOAuthGrant.id, grantId), eq(mcpOAuthGrant.user_id, userId)))
    .returning({ id: mcpOAuthGrant.id });

  if (result.length === 0) {
    return NextResponse.json({ error: 'Conexión no encontrada' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
