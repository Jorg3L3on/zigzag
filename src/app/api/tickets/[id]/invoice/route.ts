import { NextResponse } from 'next/server';
import { getTicketById } from '@/actions/tickets';
import { fail, requireApiPermission } from '@/lib/api-helpers';
import { isErrorCode } from '@/lib/error-catalog';
import { buildFintechInvoicePayload } from '@/lib/fintech-invoice-payload';
import { loadCompanyLogoImageDataUrl } from '@/lib/company-logo-branding-server';
import { renderFintechInvoicePdf } from '@/lib/fintech-invoice-renderer';
import { buildTicketPdfFileName } from '@/lib/ticket-pdf-data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const ticketId = Number(id);
    if (!Number.isInteger(ticketId) || ticketId <= 0) {
      return fail('TC008', 404, 'validation');
    }

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
      ticketId,
      parsedCompanyId,
    );

    if (!result.success) {
      return fail(
        isErrorCode(result.errorCode) ? result.errorCode : 'TC003',
        404,
        result.errorType || 'validation',
      );
    }

    if (
      !session.user.company_is_system &&
      result.data.company_id !== session.user.company_id
    ) {
      return fail('AU002', 403, 'auth');
    }

    const payload = buildFintechInvoicePayload(result.data);
    const issuerLogoDataUrl = await loadCompanyLogoImageDataUrl(
      payload.issuer.logoUrl,
    );
    const pdf = renderFintechInvoicePdf(payload, { issuerLogoDataUrl });
    const filename = buildTicketPdfFileName(result.data);

    return new NextResponse(pdf, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename.replace(/"/g, '')}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Error generating ticket invoice PDF:', error);
    return fail('PDF001', 500, 'server');
  }
}
