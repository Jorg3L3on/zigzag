import type { InvoiceData } from '@/components/pdf/invoice-types';
import {
  INVOICE_ACCENT,
  INVOICE_COMPANY,
  INVOICE_TABLE_HEAD_BG,
} from '@/components/pdf/invoice-company';

export type { InvoiceData, InvoiceItem } from '@/components/pdf/invoice-types';

const parseMoney = (value: string): number => {
  const n = Number.parseFloat(value.replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

const formatMoney = (amount: number): string =>
  amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/** Subtle corner graphic — strokes only, no filters (html2canvas-safe). */
const HeaderCornerGraphic = () => (
  <svg
    width={88}
    height={88}
    viewBox="0 0 88 88"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="shrink-0"
    aria-hidden
  >
    <g opacity={0.42} stroke={INVOICE_ACCENT} strokeWidth={0.85}>
      <ellipse cx={44} cy={44} rx={36} ry={22} />
      <ellipse cx={44} cy={44} rx={22} ry={36} />
      <circle cx={44} cy={44} r={34} />
      <circle cx={44} cy={44} r={10} />
      <path d="M44 10v68M10 44h68M20 20l48 48M68 20L20 68" />
    </g>
  </svg>
);

const FooterIconPhone = () => (
  <svg
    width={18}
    height={18}
    viewBox="0 0 24 24"
    fill="none"
    stroke={INVOICE_ACCENT}
    strokeWidth={1.6}
    aria-hidden
  >
    <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
  </svg>
);

const FooterIconMail = () => (
  <svg
    width={18}
    height={18}
    viewBox="0 0 24 24"
    fill="none"
    stroke={INVOICE_ACCENT}
    strokeWidth={1.6}
    aria-hidden
  >
    <rect x={3} y={5} width={18} height={14} rx={2} />
    <path d="M3 7l9 6 9-6" />
  </svg>
);

const FooterIconLocation = () => (
  <svg
    width={18}
    height={18}
    viewBox="0 0 24 24"
    fill="none"
    stroke={INVOICE_ACCENT}
    strokeWidth={1.6}
    aria-hidden
  >
    <path d="M12 21s7-4.35 7-10a7 7 0 10-14 0c0 5.65 7 10 7 10z" />
    <circle cx={12} cy={11} r={2.5} />
  </svg>
);

const DEFAULT_TERMS =
  'Payment is due within the terms noted above. Late payments may incur fees. Please include the invoice number with your payment.';
const DEFAULT_PAYMENT_INFO =
  'Bank transfer or approved payment methods only. Reference your invoice number on all remittances.';

/**
 * Reference-style A4 invoice — DOM → html2canvas → jsPDF.
 * Visual structure mirrors provided Invoice Fly–style reference (flat colors, generous whitespace).
 */
export default function InvoiceTemplate({ data }: { data: InvoiceData }) {
  const poNumber = data.poNumber?.trim() || '—';
  const paymentTerms = data.paymentTerms?.trim() || 'Due on receipt';
  const termsBody = data.termsAndConditions?.trim() || DEFAULT_TERMS;
  const paymentBody = data.paymentInformation?.trim() || DEFAULT_PAYMENT_INFO;

  const subtotal = data.items.reduce((acc, row) => acc + parseMoney(row.total), 0);
  const taxRate = 0.1;
  const taxAmount = Math.round(subtotal * taxRate * 100) / 100;
  const discount = 0;
  const shipping = 0;
  const totalAmount = subtotal + taxAmount - discount + shipping;
  const amountPaid = 0;
  const balanceDue = totalAmount - amountPaid;

  const billLines = [
    data.clientName,
    data.clientAddress,
    [data.clientCity, data.clientCountry].filter(Boolean).join(', '),
  ].filter(Boolean);

  return (
    <div
      className="box-border flex min-h-[297mm] flex-col bg-white text-neutral-900 antialiased"
      style={{
        width: '210mm',
        minHeight: '297mm',
        padding: '16mm 20mm 18mm',
        fontSize: '12px',
        lineHeight: 1.65,
        fontFamily:
          'var(--font-geist-sans), "Inter", ui-sans-serif, system-ui, sans-serif',
        WebkitFontSmoothing: 'antialiased',
        color: '#171717',
      }}
    >
      {/* ——— Header ——— */}
      <header className="flex flex-row items-start justify-between gap-[8mm]">
        <div className="flex min-w-0 flex-row items-start gap-[5mm]">
          <div
            className="flex shrink-0 flex-col items-center justify-center px-[10mm] py-[3.5mm] text-[11px] font-bold uppercase tracking-[0.12em] text-white"
            style={{ backgroundColor: INVOICE_ACCENT }}
            aria-hidden
          >
            {INVOICE_COMPANY.logoLabel}
          </div>
          <div className="min-w-0 pt-[0.5mm]">
            {INVOICE_COMPANY.nameLines.map((line) => (
              <p
                key={line}
                className="text-[19px] font-bold uppercase leading-[1.15] tracking-[0.02em] text-neutral-950"
              >
                {line}
              </p>
            ))}
            <div className="mt-[4mm] space-y-[1.5mm] text-[11px] leading-relaxed text-neutral-600">
              {INVOICE_COMPANY.detailLines.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-[3mm] text-right">
          <HeaderCornerGraphic />
          <div className="mt-[1mm] space-y-[2mm] text-[12px] leading-snug text-neutral-700">
            <p>
              <span className="font-bold text-neutral-950">Invoice no : </span>
              <span className="font-bold tabular-nums text-neutral-950">
                {data.invoiceNumber}
              </span>
            </p>
            <p>
              <span className="text-neutral-500">Date : </span>
              <span className="tabular-nums text-neutral-900">{data.issueDate}</span>
            </p>
            <p>
              <span className="text-neutral-500">Due Date: </span>
              <span className="tabular-nums text-neutral-900">{data.dueDate}</span>
            </p>
            <p>
              <span className="text-neutral-500">PO Number: </span>
              <span className="tabular-nums text-neutral-900">{poNumber}</span>
            </p>
          </div>
        </div>
      </header>

      {/* Title strip */}
      <div className="mt-[12mm] flex flex-row items-center gap-[4mm]">
        <div
          className="h-[4mm] w-[22mm] shrink-0 rounded-[1px]"
          style={{ backgroundColor: INVOICE_ACCENT }}
        />
        <h1 className="text-[30px] font-bold uppercase leading-none tracking-[0.06em] text-neutral-950">
          Invoice
        </h1>
      </div>

      {/* Bill / Ship */}
      <section className="mt-[14mm] grid grid-cols-2 gap-x-[14mm] gap-y-[6mm]">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-500">
            Bill To:
          </p>
          <div className="mt-[5mm] space-y-[2mm]">
            <p className="text-[13px] font-bold uppercase leading-snug tracking-wide text-neutral-950">
              {data.clientName}
            </p>
            <div className="space-y-[1.5mm] text-[11px] leading-relaxed text-neutral-600">
              {billLines.slice(1).map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          </div>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-500">
            Ship To:
          </p>
          <div className="mt-[5mm] space-y-[2mm]">
            <p className="text-[13px] font-bold uppercase leading-snug tracking-wide text-neutral-950">
              {data.clientName}
            </p>
            <div className="space-y-[1.5mm] text-[11px] leading-relaxed text-neutral-600">
              {billLines.slice(1).map((line) => (
                <p key={`ship-${line}`}>{line}</p>
              ))}
            </div>
          </div>
        </div>
      </section>

      <p className="mt-[10mm] text-[11px] leading-relaxed text-neutral-700">
        <span className="font-bold text-neutral-900">Payment Terms: </span>
        {paymentTerms}
      </p>

      {/* Line items */}
      <div className="mt-[12mm] w-full">
        <table
          className="w-full border-collapse text-[12px]"
          style={{ tableLayout: 'fixed' }}
        >
          <thead>
            <tr style={{ backgroundColor: INVOICE_TABLE_HEAD_BG }}>
              <th className="w-[10%] py-[4.5mm] pl-[2mm] pr-[2mm] text-left text-[10px] font-bold uppercase tracking-[0.1em] text-neutral-700">
                No.
              </th>
              <th className="w-[42%] py-[4.5mm] pr-[3mm] text-left text-[10px] font-bold uppercase tracking-[0.1em] text-neutral-700">
                Description
              </th>
              <th className="w-[12%] py-[4.5mm] px-[2mm] text-center text-[10px] font-bold uppercase tracking-[0.1em] text-neutral-700">
                Qty
              </th>
              <th className="w-[18%] py-[4.5mm] px-[2mm] text-right text-[10px] font-bold uppercase tracking-[0.1em] text-neutral-700">
                Price
              </th>
              <th className="w-[18%] py-[4.5mm] pr-[2mm] pl-[2mm] text-right text-[10px] font-bold uppercase tracking-[0.1em] text-neutral-700">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item, index) => (
              <tr
                key={`${item.description}-${index}`}
                className="border-t border-dotted border-neutral-300"
                style={{ pageBreakInside: 'avoid' }}
              >
                <td className="py-[5mm] pl-[2mm] pr-[2mm] align-middle tabular-nums text-neutral-800">
                  {index + 1}
                </td>
                <td className="py-[5mm] pr-[3mm] align-middle text-neutral-900 break-words">
                  {item.description}
                </td>
                <td className="py-[5mm] px-[2mm] align-middle text-center tabular-nums text-neutral-800">
                  {item.quantity}
                </td>
                <td className="py-[5mm] px-[2mm] align-middle text-right tabular-nums text-neutral-800">
                  ${item.unitPrice}
                </td>
                <td className="py-[5mm] pr-[2mm] pl-[2mm] align-middle text-right font-semibold tabular-nums text-neutral-950">
                  ${item.total}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals + notes */}
      <section className="mt-[14mm] grid grid-cols-[minmax(0,1fr)_248px] gap-x-[12mm] gap-y-[6mm]">
        <div className="min-w-0 space-y-[8mm] pr-[2mm]">
          <div>
            <p className="text-[11px] font-bold text-neutral-950">
              Term and Conditions :
            </p>
            <p className="mt-[3mm] text-[11px] leading-relaxed text-neutral-600">
              {termsBody}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-bold text-neutral-950">
              Payment Information:
            </p>
            <p className="mt-[3mm] text-[11px] leading-relaxed text-neutral-600">
              {paymentBody}
            </p>
          </div>
        </div>

        <div className="min-w-0 justify-self-end">
          <dl className="w-full min-w-[220px] space-y-[3.5mm] text-[12px]">
            <div className="flex flex-row justify-between gap-[6mm] border-b border-transparent pb-[1mm]">
              <dt className="text-neutral-600">Sub Total</dt>
              <dd className="tabular-nums text-neutral-950">${formatMoney(subtotal)}</dd>
            </div>
            <div className="flex flex-row justify-between gap-[6mm]">
              <dt className="text-neutral-600">Tax 10%</dt>
              <dd className="tabular-nums text-neutral-950">${formatMoney(taxAmount)}</dd>
            </div>
            <div className="flex flex-row justify-between gap-[6mm]">
              <dt className="text-neutral-600">Discount</dt>
              <dd className="tabular-nums text-neutral-950">${formatMoney(discount)}</dd>
            </div>
            <div className="flex flex-row justify-between gap-[6mm]">
              <dt className="text-neutral-600">Shipping</dt>
              <dd className="tabular-nums text-neutral-950">${formatMoney(shipping)}</dd>
            </div>
            <div className="flex flex-row justify-between gap-[6mm] pt-[2mm]">
              <dt className="font-bold text-neutral-950">Total Amount</dt>
              <dd className="font-bold tabular-nums text-neutral-950">
                ${formatMoney(totalAmount)}
              </dd>
            </div>
            <div className="flex flex-row justify-between gap-[6mm]">
              <dt className="text-neutral-600">Amount Paid</dt>
              <dd className="tabular-nums text-neutral-950">${formatMoney(amountPaid)}</dd>
            </div>
          </dl>
        </div>
      </section>

      {/* Balance due bar */}
      <div
        className="mt-[8mm] flex flex-row items-center justify-between px-[6mm] py-[4.5mm]"
        style={{ backgroundColor: INVOICE_ACCENT }}
      >
        <span className="text-[13px] font-bold uppercase tracking-[0.14em] text-white">
          Balance Due
        </span>
        <span className="text-[18px] font-bold tabular-nums tracking-tight text-white">
          ${formatMoney(balanceDue)}
        </span>
      </div>

      <div className="min-h-[10mm] flex-1" aria-hidden />

      {/* Footer */}
      <footer className="mt-[14mm] border-t border-neutral-200 pt-[8mm]">
        <div className="grid grid-cols-3 gap-[6mm] text-center">
          <div className="flex flex-col items-center gap-[2.5mm]">
            <FooterIconPhone />
            <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-800">
              Phone
            </p>
            <p className="text-[11px] text-neutral-600">{INVOICE_COMPANY.footerPhone}</p>
          </div>
          <div className="flex flex-col items-center gap-[2.5mm]">
            <FooterIconMail />
            <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-800">
              Mail
            </p>
            <p className="text-[11px] break-all text-neutral-600">
              {INVOICE_COMPANY.footerEmail}
            </p>
          </div>
          <div className="flex flex-col items-center gap-[2.5mm]">
            <FooterIconLocation />
            <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-800">
              Address
            </p>
            <p className="text-[11px] leading-snug text-neutral-600">
              {INVOICE_COMPANY.footerAddress}
            </p>
          </div>
        </div>
      </footer>

      <p className="pb-[2mm] pt-[6mm] text-center text-[10px] text-neutral-400">
        {INVOICE_COMPANY.nameLines.join(' ')}
      </p>
    </div>
  );
}
