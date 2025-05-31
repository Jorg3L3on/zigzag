import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hash } from 'bcryptjs';

// Helper function to transform BigInt values
function transformBigInt<T>(data: T): T {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === 'bigint') {
    return data.toString() as unknown as T;
  }

  if (Array.isArray(data)) {
    return data.map(transformBigInt) as unknown as T;
  }

  if (typeof data === 'object') {
    const transformed: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as object)) {
      transformed[key] = transformBigInt(value);
    }
    return transformed as unknown as T;
  }

  return data;
}

export async function GET() {
  try {
    const users = await db.user.findMany();
    return NextResponse.json(users);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { password } = body;

    const hashedPassword = await hash(password, 10);

    const user = await db.user.create({
      data: {
        ...body,
        password: hashedPassword,
      },
    });
    return NextResponse.json(transformBigInt(user));
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
