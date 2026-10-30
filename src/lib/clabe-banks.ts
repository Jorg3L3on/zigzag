/**
 * Bank from the first three digits of a CLABE (ZIG-36). A hint only: the
 * company form shows it under the CLABE and warns softly when the typed bank
 * looks different. It never blocks saving and is never stored.
 *
 * Source: Banxico CEP-SCL institution list
 * (https://www.banxico.org.mx/cep-scl/listaInstituciones.do), read 2026-10-30;
 * the CLABE prefix is the last three digits of the institution key. Cross-check:
 * Banxico "Participantes directos en el SPEI" (list of 2026-09-23) and the ABM
 * numbers in the Federal Reserve FedGlobal ACH manual, appendix G (2026-08-03).
 * Only prefixes confirmed in both are listed. Left out on purpose: 170 Revolut
 * Bank, 660 Altor, 722 Mercado Pago W, 727 Transfer Direct and 728 Spin by
 * OXXO (no ABM cross-check), and 2001 Banxico, 90901 CLS, 90902 Indeval and
 * 90903 CoDi Valida (no customer accounts). An unknown prefix shows nothing.
 */
import { normalizeClabe } from '@/lib/company-payment-info';

type ClabeBank = {
  /** Name shown to the user. */
  name: string;
  /** Other names people type for the same bank, for the mismatch check. */
  aliases?: string[];
};

export const CLABE_BANKS: Readonly<Record<string, ClabeBank>> = {
  '002': { name: 'Banamex', aliases: ['Citibanamex'] },
  '006': { name: 'Bancomext' },
  '009': { name: 'Banobras' },
  '012': { name: 'BBVA México', aliases: ['Bancomer'] },
  '014': { name: 'Santander' },
  '019': { name: 'Banjército' },
  '021': { name: 'HSBC' },
  '030': { name: 'BanBajío', aliases: ['Bajío'] },
  '036': { name: 'Inbursa' },
  '042': { name: 'Mifel' },
  '044': { name: 'Scotiabank' },
  '058': { name: 'Banregio' },
  '059': { name: 'Invex' },
  '060': { name: 'Bansi' },
  '062': { name: 'Afirme' },
  '072': { name: 'Banorte' },
  '106': { name: 'Bank of America', aliases: ['BofA'] },
  '108': { name: 'MUFG' },
  '110': { name: 'J.P. Morgan' },
  '112': { name: 'Banco Monex', aliases: ['Monex'] },
  '113': { name: 'Ve por Más', aliases: ['BX+'] },
  '124': { name: 'Citi México', aliases: ['Citi'] },
  '127': { name: 'Banco Azteca' },
  '128': { name: 'Kapital' },
  '129': { name: 'Barclays' },
  '130': { name: 'Compartamos' },
  '132': { name: 'Multiva' },
  '133': { name: 'Actinver' },
  '135': { name: 'Nafin', aliases: ['Nacional Financiera'] },
  '136': { name: 'Intercam' },
  '137': { name: 'BanCoppel', aliases: ['Coppel'] },
  '138': { name: 'Ualá' },
  '140': { name: 'Consubanco' },
  '141': { name: 'Volkswagen Bank', aliases: ['Volkswagen', 'VW'] },
  '145': { name: 'Banco Base', aliases: ['BBase'] },
  '147': { name: 'Bankaool' },
  '148': { name: 'PagaTodo' },
  '150': { name: 'Banco Inmobiliario', aliases: ['Inmobiliario Mexicano'] },
  '151': { name: 'Dondé' },
  '152': { name: 'Bancrea' },
  '154': { name: 'Banco Covalto', aliases: ['Covalto'] },
  '155': { name: 'ICBC' },
  '156': { name: 'Sabadell' },
  '157': { name: 'Shinhan' },
  '158': { name: 'Mizuho' },
  '159': { name: 'Bank of China' },
  '160': { name: 'Banco S3' },
  '166': { name: 'Banco del Bienestar', aliases: ['BaBien', 'Bienestar'] },
  '167': { name: 'Hey Banco', aliases: ['Hey'] },
  '168': { name: 'Hipotecaria Federal' },
  '600': { name: 'Monex Casa de Bolsa', aliases: ['Monex'] },
  '601': { name: 'GBM' },
  '602': { name: 'Masari' },
  '605': { name: 'Value' },
  '616': { name: 'Finamex' },
  '617': { name: 'Valmex' },
  '620': { name: 'Profuturo' },
  '631': { name: 'TRF' },
  '634': { name: 'Fincomún' },
  '638': { name: 'Nu México', aliases: ['Nu', 'Nubank'] },
  '646': { name: 'STP' },
  '652': { name: 'Credicapital' },
  '653': { name: 'Kuspit' },
  '656': { name: 'Unagra' },
  '659': { name: 'ASP Integra OPC' },
  '661': { name: 'Klar' },
  '670': { name: 'Libertad' },
  '677': { name: 'Caja Popular Mexicana' },
  '680': { name: 'Cristóbal Colón' },
  '683': { name: 'Caja Telefonistas' },
  '684': { name: 'Transfer' },
  '685': { name: 'Fondo FIRA', aliases: ['FIRA'] },
  '688': { name: 'Crediclub' },
  '699': { name: 'Fondeadora' },
  '703': { name: 'Tesored' },
  '706': { name: 'Arcus' },
  '710': { name: 'NVIO' },
  '714': { name: 'PPBalance' },
  '715': { name: 'Cashi' },
  '720': { name: 'MexPago' },
  '721': { name: 'albo' },
  '723': { name: 'Cuenca' },
  '725': { name: 'Coopdesarrollo' },
  '729': { name: 'Dep y Pag Dig' },
  '730': { name: 'Clip' },
  '732': { name: 'Peibo' },
  '734': { name: 'Finco Pay' },
  '738': { name: 'Fintoc' },
};

/** Bank name for the CLABE's first three digits; null when short or unknown. */
export const bankFromClabe = (value: string | null | undefined): string | null => {
  const prefix = normalizeClabe(value).slice(0, 3);
  if (!/^\d{3}$/.test(prefix)) return null;
  return CLABE_BANKS[prefix]?.name ?? null;
};

// Words that say nothing about which bank it is ("Banco del Bajío" → "bajio").
const FILLER_WORDS = new Set(['banco', 'bank', 'mexico', 'de', 'del', 'la', 'of', 'the', 'sa']);

const bankKey = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9+]+/)
    .filter((word) => word && !FILLER_WORDS.has(word))
    .join('');

/**
 * Whether the bank typed in the form clearly differs from the CLABE's bank.
 * Loose on purpose (a warning, not an error): "BBVA", "Bancomer" and
 * "BBVA México" all fit 012; an empty, filler-only or unknown-prefix input
 * never differs.
 */
export const bankDiffersFromClabe = (
  typedBank: string | null | undefined,
  clabe: string | null | undefined,
): boolean => {
  const prefix = normalizeClabe(clabe).slice(0, 3);
  const bank = /^\d{3}$/.test(prefix) ? CLABE_BANKS[prefix] : undefined;
  const typed = bankKey(typedBank ?? '');
  if (!bank || !typed) return false;
  return ![bank.name, ...(bank.aliases ?? [])].some((candidate) => {
    const key = bankKey(candidate);
    return typed.includes(key) || (typed.length >= 3 && key.includes(typed));
  });
};
