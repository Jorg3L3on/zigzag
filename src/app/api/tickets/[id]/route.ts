import { NextResponse } from 'next/server';
import { getTicketById } from '@/actions/tickets';
import { auth } from '@/lib/auth';
import { convertBigIntToString } from '@/lib/utils';
import { fail, ok } from '@/lib/api-helpers';

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return fail('Unauthorized', 401, 'auth');
    }

    const { id } = await context.params;
    const result = await getTicketById(Number(id));

    if (!result.success || !result.data) {
      return fail(
        result.error || 'Ticket no encontrado',
        404,
        result.errorType || 'validation',
      );
    }

    if (
      !session.user.company_is_system &&
      result.data.company_id !== session.user.company_id
    ) {
      return fail('Forbidden', 403, 'auth');
    }

    return ok(convertBigIntToString(result.data));
  } catch (error: unknown) {
    console.error('Error fetching ticket:', error);
    return fail('Error al obtener el ticket', 500, 'server');
  }
}
