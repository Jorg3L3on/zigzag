'use client';

import Image from 'next/image';
import { Check, Circle } from 'lucide-react';

import type { Company } from '@/db/schema';
import { companyLifecycleLabel } from '@/lib/company-lifecycle';
import {
  buildPaymentInfoLines,
  getCompanyPaymentInfo,
} from '@/lib/company-payment-info';
import { assessCompanyReadiness, OWNER_STATUS_NOTE } from '@/lib/company-readiness';
import type { CompanyBootstrapFormValues } from '@/lib/company-schema';
import {
  buildReceiptPdfPayload,
  type ReceiptPdfTicket,
} from '@/lib/receipt-pdf/payload';
import { cn } from '@/lib/utils';

type CompanyReceiptPreviewProps = {
  company: Company;
  /** Current form values: the preview follows what is typed, before saving. */
  values: CompanyBootstrapFormValues;
  /** Folio the next recibo will get (`R-0062`). */
  nextReceiptFolio: string;
  className?: string;
};

/** The saved company with the form values on top, as the PDF would read it after saving. */
export const mergeCompanyFormValues = (
  company: Company,
  values: CompanyBootstrapFormValues,
): Company => ({
  ...company,
  name: values.name,
  email: values.email,
  phone: values.phone,
  street: values.street,
  interior_number: values.interior_number?.trim() ? values.interior_number : null,
  exterior_number: values.exterior_number,
  neighborhood: values.neighborhood,
  city: values.city,
  state: values.state,
  country: values.country,
  postal_code: values.postal_code,
  settings: {
    ...(company.settings ?? {}),
    ...(values.settings ?? {}),
    payment_kind: values.settings?.payment_kind || undefined,
    experience_mode:
      values.settings?.experience_mode === 'campo' ||
      values.settings?.experience_mode === 'office'
        ? values.settings.experience_mode
        : undefined,
  },
});

/**
 * Header and footer of the recibo PDF for the given company, from the same
 * `buildReceiptPdfPayload` the PDF route uses (ZIG-I32-1): an unpaid empty
 * recibo, so the payment block shows whenever the company has payment data.
 */
export const buildCompanyReceiptPreview = (company: Company) =>
  buildReceiptPdfPayload({
    id: 0,
    document_kind: 'ticket',
    folio_number: null,
    folio_prefix: null,
    company,
    client: null,
    client_name: '',
    services_tickets: [],
    total: 1,
    paid: 0,
    ticket_date: null,
  } as unknown as ReceiptPdfTicket);

/** "Así se ve en tu recibo" aside of Datos on md+ (canvas EmpDatos). */
export const CompanyReceiptPreview = ({
  company,
  values,
  nextReceiptFolio,
  className,
}: CompanyReceiptPreviewProps) => {
  const merged = mergeCompanyFormValues(company, values);
  const { company: issuer } = buildCompanyReceiptPreview(merged);
  const paymentLines = buildPaymentInfoLines(getCompanyPaymentInfo(merged.settings));
  const readiness = assessCompanyReadiness(merged);
  // The four the canvas lists first, then any other profile gap by its label.
  const keyChecks = [
    { key: 'profile.name', label: 'Nombre' },
    { key: 'profile.email', label: 'Correo' },
    { key: 'profile.phone', label: 'Teléfono' },
    { key: 'profile.street', label: 'Calle' },
  ] as const;
  const keyCheckSet = new Set<string>(keyChecks.map((check) => check.key));
  const otherGaps = readiness.missingLabels.filter(
    (_, index) =>
      readiness.missing[index] !== 'lifecycle.active' &&
      !keyCheckSet.has(readiness.missing[index]),
  );

  return (
    <aside
      aria-label="Vista previa del recibo"
      className={cn('rounded-xl border bg-card p-4', className)}
      data-testid="company-receipt-preview"
    >
      <p className="text-caption font-semibold uppercase tracking-wider text-muted-foreground">
        Así se ve en tu recibo
      </p>

      {/* Paper colours on purpose: the PDF is always black on white. */}
      <div className="mt-3 rounded-md border border-zinc-200 bg-white p-3.5 text-zinc-900">
        <div className="flex items-center gap-2.5">
          {issuer.logoUrl ? (
            <span className="relative size-8 shrink-0 overflow-hidden rounded-full">
              <Image
                src={issuer.logoUrl}
                alt=""
                fill
                sizes="32px"
                className="object-contain"
                unoptimized={issuer.logoUrl.startsWith('/')}
              />
            </span>
          ) : (
            <span
              aria-hidden
              className="flex size-8 shrink-0 items-center justify-center rounded-full border-[1.5px] border-zinc-900 text-caption font-semibold"
            >
              {issuer.initial}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="break-words text-sm font-semibold" data-testid="receipt-preview-name">
              {issuer.name}
            </p>
            {issuer.tagline ? (
              <p
                className="line-clamp-2 text-caption text-zinc-500"
                data-testid="receipt-preview-tagline"
              >
                {issuer.tagline}
              </p>
            ) : null}
          </div>
          <div className="shrink-0 text-right">
            <p className="text-sm font-medium tracking-tight">RECIBO</p>
            <p className="font-mono text-caption">Folio {nextReceiptFolio}</p>
          </div>
        </div>
        <div className="mt-2.5 h-0.5 bg-zinc-900" />
        <div className="mt-0.5 h-px bg-zinc-900" />
        <dl
          className="mt-2.5 flex flex-col gap-1.5 text-caption leading-snug text-zinc-700"
          data-testid="receipt-preview-footer"
        >
          {[
            ['Teléfono', issuer.phone],
            ['Correo', issuer.email],
            ['Dirección', issuer.address],
          ].map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="sr-only">{label}</dt>
              <dd className="break-words">{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div
        className="mt-3 rounded-xl bg-[#dcf8c6] px-3 py-2.5 text-caption leading-relaxed text-zinc-800"
        data-testid="receipt-preview-whatsapp"
      >
        <p>
          Hola, te escribe <span className="font-semibold">{issuer.name}</span>. Te
          compartimos el recibo del ticket {nextReceiptFolio}…
        </p>
        {paymentLines.length > 0 ? (
          <div className="mt-1.5">
            {paymentLines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        ) : (
          // The slots the message fills once the company adds them (canvas EmpDatos).
          <p className="mt-1.5 text-zinc-500">
            Para pagar por transferencia: [Banco] · [Titular] · [CLABE]
          </p>
        )}
      </div>

      <div className="mt-4" data-testid="receipt-preview-readiness">
        <p className="text-caption font-semibold uppercase tracking-wider text-muted-foreground">
          Lista para operar
        </p>
        <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-sm" data-testid="receipt-preview-checks">
          {keyChecks.map((check) => {
            const ok = !readiness.missing.includes(check.key);
            return (
              <li
                key={check.key}
                className={cn('flex items-center gap-1', ok ? 'text-foreground/80' : 'text-muted-foreground')}
              >
                {ok ? (
                  <Check className="size-4 text-emerald-600" aria-hidden />
                ) : (
                  <Circle className="size-3.5 text-amber-500" aria-hidden />
                )}
                <span>
                  {check.label}
                  <span className="sr-only">{ok ? ': listo' : ': falta'}</span>
                </span>
              </li>
            );
          })}
        </ul>
        {otherGaps.length > 0 ? (
          <p className="mt-1.5 text-caption text-muted-foreground">
            También falta: {otherGaps.join(', ')}.
          </p>
        ) : null}
        {paymentLines.length === 0 ? (
          <p className="mt-1.5 text-caption text-muted-foreground">
            Sin datos de pago el recibo no imprime la sección de transferencia.
          </p>
        ) : null}
        {readiness.lifecycle !== 'ACTIVE' ? (
          <p className="mt-1.5 text-caption text-muted-foreground">
            Estado: {companyLifecycleLabel(merged.status)}. {OWNER_STATUS_NOTE}
          </p>
        ) : null}
      </div>
    </aside>
  );
};
