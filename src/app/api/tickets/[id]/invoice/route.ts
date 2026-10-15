import { NextResponse } from 'next/server';
import { getTicketById } from '@/actions/tickets';
import { fail, requireApiPermission } from '@/lib/api-helpers';
import { isErrorCode } from '@/lib/error-catalog';
import { loadCompanyLogoImageDataUrl } from '@/lib/company-logo-branding-server';
import { buildReceiptPdfEtag } from '@/lib/receipt-pdf/etag';
import { buildReceiptPdfPayload } from '@/lib/receipt-pdf/payload';
import { renderReceiptPdf } from '@/lib/receipt-pdf/render';
import { buildTicketPdfFileName } from '@/lib/ticket-pdf-data';
import { recordDocumentGeneratedAudit } from '@/lib/resource-audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Private, revalidate-every-time caching (ZIG-I20-4): the browser keeps the
 * PDF it has and sends If-None-Match; an unchanged document answers 304 with
 * no logo fetch and no render. Never `public`: it is company data.
 */
const CACHE_CONTROL = 'private, no-cache';

/** `If-None-Match` lists one or more entity tags (weak ones with a `W/` prefix). */
const matchesEtag = (header: string | null, etag: string): boolean =>
  header !== null &&
  header
    .split(',')
    .map((tag) => tag.trim().replace(/^W\//, ''))
    .some((tag) => tag === etag || tag === '*');

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

    const searchParams = new URL(request.url).searchParams;
    const requestedCompanyId = searchParams.get('company_id');
    const disposition =
      searchParams.get('disposition') === 'inline' ? 'inline' : 'attachment';
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

    const payload = buildReceiptPdfPayload(result.data);
    const etag = buildReceiptPdfEtag(payload);
    if (matchesEtag(request.headers?.get?.('if-none-match') ?? null, etag)) {
      return new NextResponse(null, {
        status: 304,
        headers: { ETag: etag, 'Cache-Control': CACHE_CONTROL },
      });
    }

    const logoDataUrl = await loadCompanyLogoImageDataUrl(
      payload.company.logoUrl,
    );
    const pdf = renderReceiptPdf(payload, { logoDataUrl });
    const filename = buildTicketPdfFileName(result.data);

    await recordDocumentGeneratedAudit({
      actor: {
        userId: session.user.id,
        companyId: session.user.company_id ?? null,
        companyIsSystem: Boolean(session.user.company_is_system),
      },
      resourceType: 'ticket',
      resourceId: ticketId,
      targetCompanyId: result.data.company_id ?? session.user.company_id,
      requestMeta: {
        route: `/api/tickets/${ticketId}/invoice`,
        method: 'GET',
      },
    });

    return new NextResponse(pdf, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${disposition}; filename="${filename.replace(/"/g, '')}"`,
        'Cache-Control': CACHE_CONTROL,
        ETag: etag,
      },
    });
  } catch (error) {
    console.error('Error generating ticket invoice PDF:', error);
    return fail('PDF001', 500, 'server');
  }
}
