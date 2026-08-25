import { and, eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiKey } from '@/db/schema';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { updateApiKeySchema } from '@/schemas/api-key.schema';

type RouteContext = { params: Promise<{ id: string }> };

const toApiKeyDto = (key: typeof apiKey.$inferSelect) => ({
  id: key.id,
  name: key.name,
  key_prefix: key.key_prefix,
  scopes: key.scopes,
  allowed_company_ids: key.allowed_company_ids,
  last_used_at: key.last_used_at?.toISOString() ?? null,
  expires_at: key.expires_at?.toISOString() ?? null,
  revoked_at: key.revoked_at?.toISOString() ?? null,
  created_at: key.created_at.toISOString(),
});

export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  const userId = BigInt(session.user.id);
  const { id } = await context.params;
  const keyId = Number(id);
  if (!Number.isInteger(keyId) || keyId <= 0) {
    return NextResponse.json({ error: 'Id inválido' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const input = updateApiKeySchema.parse(body);

    const existing = await db.query.apiKey.findFirst({
      where: and(eq(apiKey.id, keyId), eq(apiKey.user_id, userId)),
    });
    if (!existing || existing.revoked_at != null) {
      return NextResponse.json({ error: 'Conexión no encontrada' }, { status: 404 });
    }

    const [updated] = await db
      .update(apiKey)
      .set({
        ...(input.name != null ? { name: input.name } : {}),
        ...(input.allowed_company_ids != null
          ? { allowed_company_ids: input.allowed_company_ids }
          : {}),
      })
      .where(eq(apiKey.id, keyId))
      .returning();

    return NextResponse.json(toApiKeyDto(updated));
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
  const keyId = Number(id);
  if (!Number.isInteger(keyId) || keyId <= 0) {
    return NextResponse.json({ error: 'Id inválido' }, { status: 400 });
  }

  const existing = await db.query.apiKey.findFirst({
    where: and(eq(apiKey.id, keyId), eq(apiKey.user_id, userId)),
  });
  if (!existing) {
    return NextResponse.json({ error: 'Conexión no encontrada' }, { status: 404 });
  }

  await db
    .update(apiKey)
    .set({ revoked_at: new Date() })
    .where(eq(apiKey.id, keyId));

  return NextResponse.json({ success: true });
}
