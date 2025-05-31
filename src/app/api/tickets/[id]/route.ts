import { NextResponse } from 'next/server';
import { getTicketById } from '@/actions/tickets';
import { convertBigIntToString } from '@/lib/utils';

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const result = await getTicketById(Number(id));
    return NextResponse.json(convertBigIntToString(result));
  } catch (error: unknown) {
    console.error('Error fetching ticket:', error);
    return NextResponse.json(
      { error: 'Error al obtener el ticket' },
      { status: 500 },
    );
  }
}
