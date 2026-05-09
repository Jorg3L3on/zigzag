/**
 * Issuer branding — aligned with reference invoice header/footer blocks.
 * Adjust copy here only; layout lives in invoice-template.tsx.
 */
export const INVOICE_COMPANY = {
  /** White label inside accent logo block (reference: "LOGO"). */
  logoLabel: 'LOGO',
  /** Large uppercase stacked title beside logo (reference layout). */
  nameLines: ['SOLUCIONES', 'CHANO'] as const,
  detailLines: ['C. Camarote #121', 'Tel. (939) 165-46-35'],
  footerPhone: '(939) 165-46-35',
  footerEmail: 'contacto@solucioneschano.mx',
  footerAddress: 'C. Camarote #121, México',
} as const;

/** Primary accent aligned with the app brand palette. */
export const INVOICE_ACCENT = '#2563EB';

/** Light blue-violet table header band aligned with the app palette. */
export const INVOICE_TABLE_HEAD_BG = '#EEF2FF';
