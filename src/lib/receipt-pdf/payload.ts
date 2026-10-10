/**
 * Data for the presupuesto / recibo PDF (design 2a, docs/pdf-design-2a).
 * Built from the ticket returned by getTicketById; the renderer only formats
 * and draws what is here.
 */
import { differenceInCalendarDays, format } from 'date-fns';
import type {
  Client,
  Company,
  Service,
  ServicesTicketsRow,
  TicketPaymentRow,
  TicketRow,
} from '@/db/schema';
import { invoiceIssuerFromCompany } from '@/components/pdf/invoice-company';
import { multiplyMoney, roundMoney } from '@/lib/money';
import {
  getServiceLineDescription,
  getServiceLineName,
} from '@/lib/service-line-display';
import {
  isPresupuestoTicket,
  normalizeTicketDocumentKind,
} from '@/lib/ticket-document-kind';
import {
  getTicketBalanceDue,
  getTicketPaymentStatus,
} from '@/lib/ticket-payment-status';

/**
 * A material under a line (ZIG-I10 TicketLineMaterial). Typed by shape so the
 * PDF prints materials as soon as getTicketById returns them.
 */
export type ReceiptPdfMaterialSource = {
  name?: string | null;
  material?: { name?: string | null } | null;
  unit?: string | null;
  quantity: number | string;
  price: number | string;
  sort_order?: number | null;
  deleted_at?: Date | string | null;
};

export type ReceiptPdfTicket = TicketRow & {
  company: Company | null;
  client?: Client | null;
  services_tickets: Array<
    ServicesTicketsRow & {
      service: Service | null;
      materials?: ReceiptPdfMaterialSource[] | null;
    }
  >;
  ticket_payments?: TicketPaymentRow[];
};

export type ReceiptPdfDocType = 'presupuesto' | 'recibo';

export type ReceiptPdfMaterial = {
  name: string;
  quantity: number;
  unit: string | null;
  unitPrice: number;
  amount: number;
};

export type ReceiptPdfItem = {
  /** Two-digit position, `01`, `02`… */
  index: string;
  name: string;
  description: string;
  quantity: number;
  unitPrice: number;
  /** Line amount: service plus its materials. */
  amount: number;
  /** quantity × unitPrice, without materials. */
  serviceAmount: number;
  materials: ReceiptPdfMaterial[];
};

export type ReceiptPdfPayload = {
  docType: ReceiptPdfDocType;
  docTitle: 'PRESUPUESTO' | 'RECIBO';
  /** Six-digit folio, e.g. `001114`. */
  folio: string;
  /** `DD / MM / YYYY` */
  issueDate: string;
  /** Presupuestos with an expiry; null prints `Sin vencimiento` (or nothing on a recibo). */
  validity: { days: number; expiryDate: string } | null;
  /** Recibo only: a presupuesto prints no Estado. */
  recibo: {
    statusLabel: 'Pendiente de pago' | 'Pagado';
    paidOnDate: string | null;
  } | null;
  itemCount: number;
  company: {
    name: string;
    tagline: string | null;
    initial: string;
    logoUrl: string | null;
    phone: string;
    email: string;
    address: string;
  };
  client: {
    name: string;
    phone: string | null;
    country: string | null;
  };
  items: ReceiptPdfItem[];
  servicesSubtotal: number;
  materialsSubtotal: number;
  subtotal: number;
  /** Total minus line sum, when it is not zero. */
  adjustment: number | null;
  total: number;
  /** Recibo only. */
  paid: number | null;
  /** Recibo only. */
  balanceDue: number | null;
  bigFigure: {
    label: 'Saldo por pagar' | 'Total del presupuesto';
    value: number;
  };
  currencyCode: string;
};

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const toDate = (value: Date | string | null | undefined): Date | null => {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

/** `10 / 10 / 2026` */
export const formatReceiptDate = (date: Date): string =>
  format(date, 'dd / MM / yyyy');

export const formatReceiptFolio = (id: bigint | number | string): string =>
  String(id).padStart(6, '0');

const moneyFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** `$1,234.00 MXN`; negatives as `-$50.00 MXN`. */
export const formatReceiptMoney = (value: number, currencyCode: string): string => {
  const amount = roundMoney(value);
  const sign = amount < 0 ? '-' : '';
  return `${sign}$${moneyFormatter.format(Math.abs(amount))} ${currencyCode}`;
};

/** Quantities print without trailing zeros: `1`, `2.5`. */
export const formatReceiptQuantity = (value: number): string =>
  String(Math.round(value * 100) / 100);

const toNumber = (value: number | string | null | undefined): number => {
  const parsed = typeof value === 'string' ? Number(value) : value;
  return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : 0;
};

/** Active materials in sort order: snapshot name first, then the catalog. */
const buildMaterials = (
  sources: ReceiptPdfMaterialSource[] | null | undefined,
): ReceiptPdfMaterial[] =>
  (sources ?? [])
    .filter((source) => !source.deleted_at)
    .map((source, position) => ({ source, position }))
    .sort(
      (a, b) =>
        (a.source.sort_order ?? 0) - (b.source.sort_order ?? 0) || a.position - b.position,
    )
    .map(({ source }) => {
      const quantity = toNumber(source.quantity);
      const unitPrice = toNumber(source.price);
      return {
        name: source.name?.trim() || source.material?.name?.trim() || 'Material',
        quantity,
        unit: source.unit?.trim() || null,
        unitPrice,
        amount: multiplyMoney(unitPrice, quantity),
      };
    });

const companyInitial = (name: string): string =>
  name.trim().charAt(0).toLocaleUpperCase('es-MX') || 'Z';

const resolveClientPhone = (ticket: ReceiptPdfTicket): string | null =>
  ticket.client_tel?.trim() || ticket.client?.phone?.trim() || null;

const latestPaymentDate = (ticket: ReceiptPdfTicket): Date | null => {
  const dates = (ticket.ticket_payments ?? [])
    .map((payment) => toDate(payment.created_at))
    .filter((date): date is Date => date !== null);
  if (dates.length === 0) return null;
  return new Date(Math.max(...dates.map((date) => date.getTime())));
};

export const buildReceiptPdfPayload = (
  ticket: ReceiptPdfTicket,
  now: Date = new Date(),
): ReceiptPdfPayload => {
  const issuer = invoiceIssuerFromCompany(ticket.company);
  const currencyCode = issuer.currencyCode || 'MXN';
  const companyName = issuer.nameLines.join(' ');
  const docType: ReceiptPdfDocType = isPresupuestoTicket(
    normalizeTicketDocumentKind(ticket.document_kind),
  )
    ? 'presupuesto'
    : 'recibo';

  const items: ReceiptPdfItem[] = ticket.services_tickets
    .filter((line) => !line.deleted_at)
    .map((line, position) => {
      const quantity = isFiniteNumber(line.quantity) ? line.quantity : 0;
      const unitPrice = isFiniteNumber(line.price) ? line.price : 0;
      const serviceAmount = multiplyMoney(unitPrice, quantity);
      const materials = buildMaterials(line.materials);
      return {
        index: String(position + 1).padStart(2, '0'),
        name: getServiceLineName(line),
        description: getServiceLineDescription(line),
        quantity,
        unitPrice,
        amount: roundMoney(
          materials.reduce((sum, material) => sum + material.amount, serviceAmount),
        ),
        serviceAmount,
        materials,
      };
    });

  const servicesSubtotal = roundMoney(
    items.reduce((sum, item) => sum + item.serviceAmount, 0),
  );
  const materialsSubtotal = roundMoney(
    items.reduce(
      (sum, item) =>
        sum + item.materials.reduce((acc, material) => acc + material.amount, 0),
      0,
    ),
  );
  const subtotal = roundMoney(items.reduce((sum, item) => sum + item.amount, 0));
  const total = roundMoney(isFiniteNumber(ticket.total) ? ticket.total : subtotal);
  const adjustmentAmount = roundMoney(total - subtotal);
  const adjustment = Math.abs(adjustmentAmount) >= 0.01 ? adjustmentAmount : null;

  const issuedAt = toDate(ticket.ticket_date) ?? now;
  const issueDate = formatReceiptDate(issuedAt);

  let validity: ReceiptPdfPayload['validity'] = null;
  let recibo: ReceiptPdfPayload['recibo'] = null;
  let paid: number | null = null;
  let balanceDue: number | null = null;
  let bigFigure: ReceiptPdfPayload['bigFigure'];

  if (docType === 'presupuesto') {
    const expiresAt = toDate(ticket.expires_at);
    if (expiresAt) {
      validity = {
        days: Math.max(0, differenceInCalendarDays(expiresAt, issuedAt)),
        expiryDate: formatReceiptDate(expiresAt),
      };
    }
    bigFigure = { label: 'Total del presupuesto', value: total };
  } else {
    paid = roundMoney(Math.max(isFiniteNumber(ticket.paid) ? ticket.paid : 0, 0));
    balanceDue = roundMoney(getTicketBalanceDue(total, paid));
    const isPaid = getTicketPaymentStatus(total, paid) === 'paid';
    const paidOn = isPaid
      ? (latestPaymentDate(ticket) ?? toDate(ticket.updated_at) ?? issuedAt)
      : null;
    recibo = {
      statusLabel: isPaid ? 'Pagado' : 'Pendiente de pago',
      paidOnDate: paidOn ? formatReceiptDate(paidOn) : null,
    };
    bigFigure = { label: 'Saldo por pagar', value: balanceDue };
  }

  return {
    docType,
    docTitle: docType === 'presupuesto' ? 'PRESUPUESTO' : 'RECIBO',
    folio: formatReceiptFolio(ticket.id),
    issueDate,
    validity,
    recibo,
    itemCount: items.length,
    company: {
      name: companyName,
      tagline: issuer.tagline?.trim() || null,
      initial: companyInitial(companyName),
      logoUrl: issuer.logoUrl,
      phone: issuer.footerPhone?.trim() || '',
      email: issuer.footerEmail?.trim() || '',
      address: issuer.footerAddress?.trim() || '',
    },
    client: {
      name: ticket.client_name?.trim() || 'Cliente',
      phone: resolveClientPhone(ticket),
      country: ticket.client?.country?.trim() || null,
    },
    items,
    servicesSubtotal,
    materialsSubtotal,
    subtotal,
    adjustment,
    total,
    paid,
    balanceDue,
    bigFigure,
    currencyCode,
  };
};
