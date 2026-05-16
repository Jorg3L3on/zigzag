import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import type { ActionErrorType } from '@/lib/errors';
import { and, eq, isNull } from 'drizzle-orm';
import { user } from '@/db/schema';
import { db } from '@/lib/db';

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function fail(error: string, status = 400, errorType?: ActionErrorType) {
  return NextResponse.json(
    { success: false, error, ...(errorType ? { errorType } : {}) },
    { status },
  );
}

export async function requireSession() {
  const session = await auth();
  if (!session?.user?.id) {
    return { session: null, unauthorized: fail('Unauthorized', 401) };
  }

  const activeUser = await db.query.user.findFirst({
    where: and(eq(user.id, BigInt(session.user.id)), isNull(user.deleted_at)),
    with: {
      company: true,
    },
  });

  if (
    !activeUser?.company ||
    activeUser.company.deleted_at ||
    activeUser.company.status !== 'ACTIVE'
  ) {
    return { session: null, unauthorized: fail('Unauthorized', 401) };
  }

  return { session, unauthorized: null };
}
