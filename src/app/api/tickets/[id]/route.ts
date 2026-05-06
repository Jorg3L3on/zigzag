import { NextResponse } from 'next/server';
import { getTicketById } from '@/actions/tickets';
import { auth } from '@/lib/auth';
import { convertBigIntToString } from '@/lib/utils';

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const result = await getTicketById(Number(id));

    if (!result.success || !result.data) {
      return NextResponse.json(convertBigIntToString(result), { status: 404 });
    }

    if (
      !session.user.company_is_system &&
      result.data.company_id !== session.user.company_id
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json(convertBigIntToString(result));
  } catch (error: unknown) {
    console.error('Error fetching ticket:', error);
    return NextResponse.json(
      { error: 'Error al obtener el ticket' },
      { status: 500 },
    );
  }
}
