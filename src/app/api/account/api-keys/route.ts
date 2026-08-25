import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { apiKey } from '@/db/schema';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { checkRateLimit } from '@/lib/rate-limiter';
import { generateAgentToken, hashAgentToken } from '@/lib/server/agent-token';
import { createApiKeySchema } from '@/schemas/api-key.schema';

const API_KEY_LIST_COLUMNS = {
  id: true,
  name: true,
  key_prefix: true,
  scopes: true,
  allowed_company_ids: true,
  last_used_at: true,
  expires_at: true,
  revoked_at: true,
  created_at: true,
} as const;

const toApiKeyDto = (key: {
  id: number;
  name: string;
  key_prefix: string;
  scopes: string[];
  allowed_company_ids: number[];
  last_used_at: Date | null;
  expires_at: Date | null;
  revoked_at: Date | null;
  created_at: Date;
}) => ({
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

async function requireSessionUserId(): Promise<bigint | NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  return BigInt(session.user.id);
}

export async function GET() {
  try {
    const userId = await requireSessionUserId();
    if (userId instanceof NextResponse) return userId;

    const keys = await db.query.apiKey.findMany({
      where: eq(apiKey.user_id, userId),
      columns: API_KEY_LIST_COLUMNS,
      orderBy: (fields, { desc }) => [desc(fields.created_at)],
    });

    return NextResponse.json(keys.map(toApiKeyDto), { status: 200 });
  } catch (error) {
    console.error('Error listing api keys:', error);
    return NextResponse.json(
      { error: 'No se pudieron cargar las conexiones' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireSessionUserId();
    if (userId instanceof NextResponse) return userId;

    const allowed = await checkRateLimit(`mutation:api-key-create:${userId}`, {
      limit: 10,
      windowMs: 60 * 60 * 1000,
    });
    if (!allowed) {
      return NextResponse.json({ error: 'Demasiadas solicitudes' }, { status: 429 });
    }

    const body = await request.json();
    const input = createApiKeySchema.parse(body);
    const { token, keyPrefix } = generateAgentToken();

    const expiresAt =
      input.expires_in_days != null
        ? new Date(Date.now() + input.expires_in_days * 24 * 60 * 60 * 1000)
        : null;

    const [created] = await db
      .insert(apiKey)
      .values({
        user_id: userId,
        name: input.name,
        key_hash: hashAgentToken(token),
        key_prefix: keyPrefix,
        scopes: input.scopes,
        allowed_company_ids: input.allowed_company_ids,
        expires_at: expiresAt,
      })
      .returning({
        id: apiKey.id,
        name: apiKey.name,
        key_prefix: apiKey.key_prefix,
        scopes: apiKey.scopes,
        allowed_company_ids: apiKey.allowed_company_ids,
        last_used_at: apiKey.last_used_at,
        expires_at: apiKey.expires_at,
        revoked_at: apiKey.revoked_at,
        created_at: apiKey.created_at,
      });

    return NextResponse.json({ ...toApiKeyDto(created), token }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Error de validación', details: error.issues },
        { status: 400 },
      );
    }
    console.error('Error creating api key:', error);
    return NextResponse.json(
      { error: 'No se pudo crear la conexión' },
      { status: 500 },
    );
  }
}
