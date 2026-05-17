import type { InvoiceData } from '@/components/pdf/invoice-types';
import {
  INVOICE_ACCENT,
  INVOICE_TABLE_HEAD_BG,
} from '@/components/pdf/invoice-company';

export type { InvoiceData, InvoiceItem } from '@/components/pdf/invoice-types';

const parseMoney = (value: string): number => {
  const n = Number.parseFloat(value.replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

const formatMoney = (amount: number): string =>
  amount.toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const SERVICE_DETAIL_SEPARATOR = '|||';

const splitServiceLabel = (value: string) => {
  const [name = '', description = ''] = value
    .split(SERVICE_DETAIL_SEPARATOR)
    .map((part) => part.trim());

  return {
    name: name || value,
    description,
  };
};

const FooterIconPhone = () => (
  <svg
    width={12}
    height={12}
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
    width={12}
    height={12}
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
    width={12}
    height={12}
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

/**
 * Reference-style A4 invoice — DOM → html2canvas → jsPDF.
 * Visual structure mirrors provided Invoice Fly–style reference (flat colors, generous whitespace).
 */
export default function InvoiceTemplate({ data }: { data: InvoiceData }) {
  const subtotal = data.items.reduce((acc, row) => acc + parseMoney(row.total), 0);
  const totalAmount = subtotal;
  const amountPaid = parseMoney(data.paidAmount ?? '0');
  const balanceDue = Math.max(totalAmount - amountPaid, 0);

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
      <header className="flex flex-row items-start justify-between gap-[4mm]">
        <div className="flex min-w-0 flex-row items-start gap-[3mm]">
          <div className="min-w-0">
            {data.issuer.nameLines.map((line, index) => (
              <p
                key={`${index}-${line}`}
                className="text-[15px] font-bold uppercase leading-[1.1] tracking-[0.02em] text-neutral-950"
              >
                {line}
              </p>
            ))}
            <div className="mt-[2mm] space-y-[0.75mm] text-[10px] leading-relaxed text-neutral-600">
              {data.issuer.detailLines.map((line, index) => (
                <p key={`${index}-${line}`}>{line}</p>
              ))}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-[1.5mm] text-right">
          <div className="space-y-[1mm] text-[10px] leading-snug text-neutral-700">
            <p>
              <span className="font-bold text-neutral-950">Ticket No.: </span>
              <span className="font-bold tabular-nums text-neutral-950">
                {data.ticketNumber}
              </span>
            </p>
            <p>
              <span className="text-neutral-500">Fecha: </span>
              <span className="tabular-nums text-neutral-900">{data.issueDate}</span>
            </p>
          </div>
        </div>
      </header>

      {/* Bill / Ship */}
      <section className="mt-[6mm]">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-500">
            Cliente:
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
      </section>

      {/* Line items */}
      <div className="mt-[7mm] w-full">
        <table
          className="w-full border-collapse text-[12px]"
          style={{ tableLayout: 'fixed' }}
        >
          <thead>
            <tr style={{ backgroundColor: INVOICE_TABLE_HEAD_BG }}>
              <th className="w-[10%] py-[4.5mm] pl-[2mm] pr-[2mm] text-left text-[10px] font-bold uppercase tracking-[0.1em] text-neutral-700">
                Núm.
              </th>
              <th className="w-[42%] py-[4.5mm] pr-[3mm] text-left text-[10px] font-bold uppercase tracking-[0.1em] text-neutral-700">
                Servicio
              </th>
              <th className="w-[12%] py-[4.5mm] px-[2mm] text-center text-[10px] font-bold uppercase tracking-[0.1em] text-neutral-700">
                Cant.
              </th>
              <th className="w-[18%] py-[4.5mm] px-[2mm] text-right text-[10px] font-bold uppercase tracking-[0.1em] text-neutral-700">
                Precio
              </th>
              <th className="w-[18%] py-[4.5mm] pr-[2mm] pl-[2mm] text-right text-[10px] font-bold uppercase tracking-[0.1em] text-neutral-700">
                Importe
              </th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item, index) => {
              const service = splitServiceLabel(item.description);

              return (
                <tr
                  key={`${item.description}-${index}`}
                  className="border-t border-dotted border-neutral-300"
                  style={{ pageBreakInside: 'avoid' }}
                >
                  <td className="py-[5mm] pl-[2mm] pr-[2mm] align-middle tabular-nums text-neutral-800">
                    {index + 1}
                  </td>
                  <td className="py-[5mm] pr-[3mm] align-middle break-words">
                    <p className="font-semibold text-neutral-900">{service.name}</p>
                    {service.description ? (
                      <p className="mt-[1mm] text-[10px] leading-snug text-neutral-500">
                        {service.description}
                      </p>
                    ) : null}
                  </td>
                  <td className="py-[5mm] px-[2mm] align-middle text-center tabular-nums text-neutral-800">
                    {item.quantity}
                  </td>
                  <td className="py-[5mm] px-[2mm] align-middle text-right tabular-nums text-neutral-800">
                    {data.issuer.currencyCode}{' '}
                    {formatMoney(parseMoney(item.unitPrice))}
                  </td>
                  <td className="py-[5mm] pr-[2mm] pl-[2mm] align-middle text-right font-semibold tabular-nums text-neutral-950">
                    {data.issuer.currencyCode}{' '}
                    {formatMoney(parseMoney(item.total))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Totals + notes */}
      <section className="mt-[14mm] grid grid-cols-[minmax(0,1fr)_248px] gap-x-[12mm] gap-y-[6mm]">
        <div className="min-w-0 pr-[2mm]" />

        <div className="min-w-0 justify-self-end">
          <dl className="w-full min-w-[220px] space-y-[3.5mm] text-[12px]">
            <div className="flex flex-row justify-between gap-[6mm] border-b border-transparent pb-[1mm]">
              <dt className="text-neutral-600">Subtotal</dt>
              <dd className="tabular-nums text-neutral-950">
                {data.issuer.currencyCode} {formatMoney(subtotal)}
              </dd>
            </div>
            <div className="flex flex-row justify-between gap-[6mm] pt-[2mm]">
              <dt className="font-bold text-neutral-950">Total</dt>
              <dd className="font-bold tabular-nums text-neutral-950">
                {data.issuer.currencyCode} {formatMoney(totalAmount)}
              </dd>
            </div>
            <div className="flex flex-row justify-between gap-[6mm]">
              <dt className="text-neutral-600">Pagado</dt>
              <dd className="tabular-nums text-neutral-950">
                {data.issuer.currencyCode} {formatMoney(amountPaid)}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      {/* Balance due bar */}
      <div
        className="mt-[8mm] flex flex-row items-center justify-between px-[6mm] py-[4.5mm]"
        style={{
          backgroundImage: 'linear-gradient(90deg, #2563EB 0%, #7C3AED 100%)',
        }}
      >
        <span className="text-[13px] font-bold uppercase tracking-[0.14em] text-white">
          {balanceDue > 0 ? 'Saldo pendiente' : 'Total del ticket'}
        </span>
        <span className="text-[18px] font-bold tabular-nums tracking-tight text-white">
          {data.issuer.currencyCode}{' '}
          {formatMoney(balanceDue > 0 ? balanceDue : totalAmount)}
        </span>
      </div>

      <div className="min-h-[5mm] flex-1" aria-hidden />

      {/* Footer */}
      <footer className="mt-[7mm] border-t border-neutral-200 pt-[4mm]">
        <div className="grid grid-cols-3 gap-[3mm] text-center">
          <div className="flex flex-col items-center gap-[1.25mm]">
            <FooterIconPhone />
            <p className="text-[9px] font-bold uppercase tracking-wide text-neutral-800">
              Teléfono
            </p>
            <p className="text-[9px] text-neutral-600">{data.issuer.footerPhone}</p>
          </div>
          <div className="flex flex-col items-center gap-[1.25mm]">
            <FooterIconMail />
            <p className="text-[9px] font-bold uppercase tracking-wide text-neutral-800">
              Correo
            </p>
            <p className="text-[9px] break-all text-neutral-600">
              {data.issuer.footerEmail}
            </p>
          </div>
          <div className="flex flex-col items-center gap-[1.25mm]">
            <FooterIconLocation />
            <p className="text-[9px] font-bold uppercase tracking-wide text-neutral-800">
              Dirección
            </p>
            <p className="text-[9px] leading-snug text-neutral-600">
              {data.issuer.footerAddress}
            </p>
          </div>
        </div>
      </footer>

      <p className="pb-[1mm] pt-[3mm] text-center text-[9px] text-neutral-400">
        Powered by{' '}
        <a
          href="https://zigzag-hazel.vercel.app"
          target="_blank"
          rel="noreferrer"
          className="pointer-events-auto font-medium text-neutral-500 underline"
        >
          zigzag
        </a>
      </p>
    </div>
  );
}
