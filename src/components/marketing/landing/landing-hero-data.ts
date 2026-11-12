/**
 * Landing hero demo (ZIG-I39-2): trades, payment modes and the pure receipt
 * math shared by the phone composer and the receipt behind it.
 */

export type HeroTradeId = 'clima' | 'plomeria' | 'electricidad' | 'mantenimiento';

export type HeroService = { name: string; amount: number };

export type HeroTrade = {
  id: HeroTradeId;
  label: string;
  client: string;
  clientSub: string;
  services: readonly [HeroService, HeroService, HeroService];
};

export const HERO_TRADES: readonly HeroTrade[] = [
  {
    id: 'clima',
    label: 'Clima',
    client: 'Hotel Riviera Dorada',
    clientSub: 'Cancún · 6 tickets',
    services: [
      { name: 'Mantenimiento preventivo A/C', amount: 850 },
      { name: 'Recarga de gas refrigerante', amount: 1400 },
      { name: 'Limpieza de evaporadora', amount: 540 },
    ],
  },
  {
    id: 'plomeria',
    label: 'Plomería',
    client: 'Restaurante Mar & Tierra',
    clientSub: 'Cancún · 4 tickets',
    services: [
      { name: 'Destape de drenaje', amount: 650 },
      { name: 'Cambio de mezcladora', amount: 900 },
      { name: 'Reparación de fuga', amount: 480 },
    ],
  },
  {
    id: 'electricidad',
    label: 'Electricidad',
    client: 'Gimnasio FitPro',
    clientSub: 'Cancún · 3 tickets',
    services: [
      { name: 'Revisión de corto circuito', amount: 450 },
      { name: 'Instalación de centro de carga', amount: 2400 },
      { name: 'Cambio de contactos', amount: 380 },
    ],
  },
  {
    id: 'mantenimiento',
    label: 'Mantenimiento',
    client: 'Plaza Comercial Aurora',
    clientSub: 'Cancún · 8 tickets',
    services: [
      { name: 'Impermeabilización de azotea', amount: 4500 },
      { name: 'Pintura de fachada', amount: 3200 },
      { name: 'Reparación de herrería', amount: 1100 },
    ],
  },
];

/** The first two services start on the ticket; the third is offered as a chip. */
export const HERO_DEFAULT_SELECTION: readonly boolean[] = [true, true, false];

export type HeroPayMode = 'full' | 'partial' | 'pending';

export const HERO_PAY_MODES: readonly { id: HeroPayMode; label: string }[] = [
  { id: 'full', label: 'Todo' },
  { id: 'partial', label: 'Una parte' },
  { id: 'pending', label: 'Nada aún' },
];

export type HeroReceiptStatus = 'PAGADO' | 'PAGO PARCIAL' | 'PENDIENTE' | 'SIN SERVICIOS';

export type HeroReceipt = {
  total: number;
  paid: number;
  saldo: number;
  /** True when "Saldo por pagar" shows on the receipt. */
  owes: boolean;
  status: HeroReceiptStatus;
};

/**
 * Totals for the demo ticket. "Una parte" pays half of the total rounded to
 * the nearest 50 (same as the canvas).
 */
export const computeHeroReceipt = (
  amounts: readonly number[],
  payMode: HeroPayMode,
): HeroReceipt => {
  const total = amounts.reduce((sum, amount) => sum + amount, 0);
  const paid =
    payMode === 'full' ? total : payMode === 'partial' ? Math.round(total / 100) * 50 : 0;
  const saldo = total - paid;
  const status: HeroReceiptStatus =
    total === 0
      ? 'SIN SERVICIOS'
      : saldo === 0
        ? 'PAGADO'
        : paid > 0
          ? 'PAGO PARCIAL'
          : 'PENDIENTE';
  return { total, paid, saldo, owes: saldo > 0, status };
};

const MONEY = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });

/** $1,400.00 */
export const formatHeroMoney = (amount: number) => MONEY.format(amount);
