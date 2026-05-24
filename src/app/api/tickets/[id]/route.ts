import { getTicketById } from '@/actions/tickets';
import { fail, ok, requireApiPermission } from '@/lib/api-helpers';
import { isErrorCode } from '@/lib/error-catalog';

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const requestedCompanyId = new URL(request.url).searchParams.get('company_id');
    const parsedCompanyId = requestedCompanyId
      ? Number.parseInt(requestedCompanyId, 10)
      : undefined;

    const { session, unauthorized } = await requireApiPermission(
      'tickets.read',
      parsedCompanyId,
    );
    if (unauthorized || !session) {
      return unauthorized;
    }

    const result = await getTicketById(
      Number(id),
      parsedCompanyId,
    );

    if (!result.success) {
      return fail(
        isErrorCode(result.errorCode) ? result.errorCode : 'TC003',
        404,
        result.errorType || 'validation',
      );
    }

    const ticketPayload = result.data;

    if (
      !session.user.company_is_system &&
      ticketPayload.company_id !== session.user.company_id
    ) {
      return fail('AU002', 403, 'auth');
    }

    return ok(ticketPayload);
  } catch (error: unknown) {
    console.error('Error fetching ticket:', error);
    return fail('TC003', 500, 'server');
  }
}
