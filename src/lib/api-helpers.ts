import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function fail(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status });
}

export async function requireSession() {
  const session = await auth();
  if (!session?.user?.id) {
    return { session: null, unauthorized: fail('Unauthorized', 401) };
  }

  return { session, unauthorized: null };
}
