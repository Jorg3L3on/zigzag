/**
 * Issuer branding for PDF invoices — defaults when company data is unavailable.
 * Layout lives in invoice-template.tsx; DB-backed values via `invoiceIssuerFromCompany`.
 */
import type { Company } from '@/db/schema';
import {
  formatCompanyAddress,
  formatCompanyAddressOneLine,
} from '@/lib/company-address';

export interface InvoiceIssuerData {
  /** Stacked uppercase title lines in the header */
  nameLines: readonly string[];
  /** Address / contact lines under the company name */
  detailLines: readonly string[];
  footerPhone: string;
  footerEmail: string;
  footerAddress: string;
  logoUrl: string | null;
  /** Company default currency code, e.g. MXN, USD. */
  currencyCode: string;
}

export const DEFAULT_INVOICE_ISSUER: InvoiceIssuerData = {
  nameLines: ['SOLUCIONES', 'CHANO'],
  detailLines: ['C. Camarote #121', 'Tel. (939) 165-46-35'],
  footerPhone: '(939) 165-46-35',
  footerEmail: 'contacto@solucioneschano.mx',
  footerAddress: 'C. Camarote #121, México',
  logoUrl: null,
  currencyCode: 'MXN',
};

const splitCompanyNameLines = (name: string): string[] => {
  const lines = name
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (lines.length > 0) {
    return lines;
  }
  return [name.trim() || 'Empresa'];
};

export const invoiceIssuerFromCompany = (
  company: Company | null | undefined,
): InvoiceIssuerData => {
  if (!company || company.deleted_at) {
    return DEFAULT_INVOICE_ISSUER;
  }

  const currencyCode = company.settings?.default_currency?.trim() || 'MXN';

  const addrBlock = formatCompanyAddress(company);
  const detailLines = [
    ...addrBlock
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean),
    company.phone ? `Tel. ${company.phone}` : '',
  ].filter(Boolean);

  return {
    nameLines: splitCompanyNameLines(company.name),
    detailLines,
    footerPhone: company.phone,
    footerEmail: company.email,
    footerAddress: formatCompanyAddressOneLine(company),
    logoUrl: company.logo ?? null,
    currencyCode,
  };
};

/** Primary accent aligned with the app brand palette. */
export const INVOICE_ACCENT = '#2563EB';

/** Light blue-violet table header band aligned with the app palette. */
export const INVOICE_TABLE_HEAD_BG = '#EEF2FF';
