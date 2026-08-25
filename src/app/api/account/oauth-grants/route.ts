import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { mcpOAuthGrant, mcpOAuthClient } from '@/db/schema';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  const userId = BigInt(session.user.id);

  const grants = await db
    .select({
      id: mcpOAuthGrant.id,
      client_id: mcpOAuthGrant.client_id,
      client_name: mcpOAuthClient.client_name,
      scopes: mcpOAuthGrant.scopes,
      allowed_company_ids: mcpOAuthGrant.allowed_company_ids,
      last_used_at: mcpOAuthGrant.last_used_at,
      expires_at: mcpOAuthGrant.expires_at,
      revoked_at: mcpOAuthGrant.revoked_at,
      created_at: mcpOAuthGrant.created_at,
    })
    .from(mcpOAuthGrant)
    .innerJoin(mcpOAuthClient, eq(mcpOAuthGrant.client_id, mcpOAuthClient.client_id))
    .where(eq(mcpOAuthGrant.user_id, userId));

  return NextResponse.json(
    grants.map((grant) => ({
      id: grant.id,
      client_id: grant.client_id,
      client_name: grant.client_name,
      scopes: grant.scopes,
      allowed_company_ids: grant.allowed_company_ids,
      last_used_at: grant.last_used_at?.toISOString() ?? null,
      expires_at: grant.expires_at?.toISOString() ?? null,
      revoked_at: grant.revoked_at?.toISOString() ?? null,
      created_at: grant.created_at.toISOString(),
    })),
  );
}
