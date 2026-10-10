/**
 * @jest-environment node
 */
import fs from 'node:fs';
import path from 'node:path';
import type { ReceiptPdfItem, ReceiptPdfPayload } from '@/lib/receipt-pdf/payload';
import { renderReceiptPdf } from '@/lib/receipt-pdf/render';
import { extractPdfText, pageText, type PdfTextPage } from '@/test/pdf-text';

/** Fixture PDFs land here for the manual fidelity pass (gitignored). */
const OUT_DIR = path.join(process.cwd(), 'test-results', 'pdf');

const item = (n: number, overrides: Partial<ReceiptPdfItem> = {}): ReceiptPdfItem => ({
  index: String(n).padStart(2, '0'),
  name: `Servicio ${n}`,
  description: '',
  quantity: 1,
  unitPrice: 100,
  amount: 100,
  materials: [],
  ...overrides,
});

const presupuesto = (overrides: Partial<ReceiptPdfPayload> = {}): ReceiptPdfPayload => ({
  docType: 'presupuesto',
  docTitle: 'PRESUPUESTO',
  folio: '001114',
  issueDate: '10 / 10 / 2026',
  validity: { days: 30, expiryDate: '09 / 11 / 2026' },
  recibo: null,
  itemCount: 2,
  company: {
    name: 'ClimaTotal Demo',
    tagline: 'Climatización · Servicio técnico',
    initial: 'C',
    logoUrl: null,
    phone: '+52 55 4123 8900',
    email: 'contacto@climatotal.demo',
    address: 'Av. Insurgentes Sur 1602, Piso 8, Crédito Constructor, Ciudad de México, CDMX, 03940',
  },
  client: { name: 'Cliente test', phone: '961 315 1552', country: 'México' },
  items: [
    item(1, { name: 'Jorge', description: 'Hh', unitPrice: 66, amount: 66 }),
    item(2, { name: 'Prueba', description: 'Una descripción del servicio', unitPrice: 259, amount: 259 }),
  ],
  servicesSubtotal: 325,
  materialsSubtotal: 0,
  subtotal: 325,
  adjustment: null,
  total: 325,
  paid: null,
  balanceDue: null,
  bigFigure: { label: 'Total del presupuesto', value: 325 },
  currencyCode: 'MXN',
  ...overrides,
});

const recibo = (overrides: Partial<ReceiptPdfPayload> = {}): ReceiptPdfPayload =>
  presupuesto({
    docType: 'recibo',
    docTitle: 'RECIBO',
    validity: null,
    recibo: { statusLabel: 'Pendiente de pago', paidOnDate: null },
    paid: 100,
    balanceDue: 225,
    bigFigure: { label: 'Saldo por pagar', value: 225 },
    ...overrides,
  });

const render = (name: string, payload: ReceiptPdfPayload, logoDataUrl: string | null = null) => {
  const bytes = renderReceiptPdf(payload, { logoDataUrl, compress: false });
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, `${name}.pdf`), Buffer.from(bytes));
  return { bytes, pages: extractPdfText(bytes) };
};

/** Asserts that `labels` appear in this order in the page text. */
const expectInOrder = (page: PdfTextPage, labels: string[]) => {
  const text = pageText(page);
  let from = 0;
  for (const label of labels) {
    const at = text.indexOf(label, from);
    expect({ label, found: at >= from }).toEqual({ label, found: true });
    from = at + label.length;
  }
};

const LETTER = { width: 612, height: 792 };

const ONE_PX_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

/** Solid PNG of the given size, built without image libraries. */
const solidPng = (width: number, height: number): string => {
  const zlib = jest.requireActual<typeof import('node:zlib')>('node:zlib');
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf: Buffer) => {
    let c = 0xffffffff;
    for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const sum = Buffer.alloc(4);
    sum.writeUInt32BE(crc(body));
    return Buffer.concat([len, body, sum]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 0; // greyscale
  const rows = Buffer.alloc((width + 1) * height, 0x40);
  for (let y = 0; y < height; y += 1) rows[y * (width + 1)] = 0;
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', zlib.deflateSync(rows)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  return `data:image/png;base64,${png.toString('base64')}`;
};

describe('renderReceiptPdf — recibo', () => {
  it('prints the 2a recibo in reading order on one Letter page', () => {
    const { bytes, pages } = render('recibo-partial', recibo());

    expect(Buffer.from(bytes).subarray(0, 5).toString('ascii')).toBe('%PDF-');
    expect(pages).toHaveLength(1);
    expect(pages[0]).toMatchObject(LETTER);
    expectInOrder(pages[0], [
      'ClimaTotal Demo',
      'Climatización · Servicio técnico',
      'RECIBO',
      'Folio 001114',
      '10 / 10 / 2026',
      'CLIENTE',
      'Cliente test',
      '961 315 1552',
      'México',
      'FECHA DE EMISIÓN',
      'Saldo pendiente',
      'ESTADO',
      'PENDIENTE DE PAGO',
      '2 conceptos',
      'CONCEPTO',
      'CANTIDAD',
      'PRECIO UNITARIO',
      'IMPORTE',
      '01',
      'Jorge',
      'Hh',
      '$66.00 MXN',
      'Prueba',
      'Una descripción del servicio',
      '$259.00 MXN',
      'Subtotal',
      '$325.00 MXN',
      'Total',
      'Pagado',
      '$100.00 MXN',
      'Saldo por pagar',
      '$225.00 MXN',
      'TELÉFONO',
      '+52 55 4123 8900',
      'CORREO',
      'contacto@climatotal.demo',
      'DIRECCIÓN',
      'RECIBO 001114 · Página 1 de 1',
      'Powered by zigzag',
    ]);
    const text = pageText(pages[0]);
    expect(text).not.toMatch(/IVA|CFDI|�/);
    expect(text).not.toContain('Ajuste');
  });

  it('uses Plex Sans for text and Plex Mono for every number', () => {
    const { pages } = render('recibo-fonts', recibo());
    const fontOf = (text: string) => pages[0].runs.find((run) => run.text === text)?.font;

    expect(fontOf('RECIBO')).toBe('PlexSans-Medium');
    expect(fontOf('Folio 001114')).toBe('PlexMono-Regular');
    expect(fontOf('ClimaTotal Demo')).toBe('PlexSans-SemiBold');
    expect(fontOf('01')).toBe('PlexMono-Regular');
    expect(fontOf('Jorge')).toBe('PlexSans-SemiBold');
    expect(fontOf('$259.00 MXN')).toBe('PlexMono-Regular');
    expect(pages[0].runs.filter((run) => run.text === '$259.00 MXN').map((run) => run.font)).toEqual([
      'PlexMono-Regular',
      'PlexMono-Medium',
    ]);
    expect(fontOf('Saldo por pagar')).toBe('PlexSans-SemiBold');
    expect(fontOf('$225.00 MXN')).toBe('PlexMono-Medium');
  });

  it('prints Pagado with the paid-on date when settled', () => {
    const { pages } = render(
      'recibo-paid',
      recibo({
        recibo: { statusLabel: 'Pagado', paidOnDate: '14 / 10 / 2026' },
        paid: 325,
        balanceDue: 0,
        bigFigure: { label: 'Saldo por pagar', value: 0 },
      }),
    );
    expectInOrder(pages[0], ['Pagado el 14 / 10 / 2026', 'PAGADO', 'Saldo por pagar', '$0.00 MXN']);
    expect(pageText(pages[0])).not.toContain('Saldo pendiente');
  });

  it('adds the Ajuste row only when there is an adjustment', () => {
    const { pages } = render(
      'recibo-adjustment',
      recibo({ adjustment: -25, total: 300, balanceDue: 200, bigFigure: { label: 'Saldo por pagar', value: 200 } }),
    );
    expectInOrder(pages[0], ['Subtotal', '$325.00 MXN', 'Ajuste', '-$25.00 MXN', 'Total', '$300.00 MXN', 'Pagado']);
  });

  it('says 1 concepto for a single item', () => {
    const { pages } = render('recibo-one-item', recibo({ items: [item(1)], itemCount: 1 }));
    expect(pageText(pages[0])).toContain('1 concepto');
    expect(pageText(pages[0])).not.toContain('1 conceptos');
  });
});

describe('renderReceiptPdf — presupuesto', () => {
  it('has Vigencia/Vence, Conceptos and Total del presupuesto, and no Estado', () => {
    const { pages } = render('presupuesto-vigencia', presupuesto());

    expect(pages).toHaveLength(1);
    expectInOrder(pages[0], [
      'PRESUPUESTO',
      'Folio 001114',
      'CLIENTE',
      'FECHA DE EMISIÓN',
      '10 / 10 / 2026',
      'Vigencia 30 días',
      'Vence 09 / 11 / 2026',
      'CONCEPTOS',
      '2',
      'conceptos',
      'CONCEPTO',
      'Subtotal',
      'Total',
      'Total del presupuesto',
      '$325.00 MXN',
      'PRESUPUESTO 001114 · Página 1 de 1',
    ]);
    const text = pageText(pages[0]);
    expect(text).not.toMatch(/ESTADO|Estado|PENDIENTE|Pagado|Saldo|IVA|CFDI/);
  });

  it('prints Sin vencimiento without an expiry', () => {
    const { pages } = render('presupuesto-sin-vencimiento', presupuesto({ validity: null }));
    expect(pageText(pages[0])).toContain('Sin vencimiento');
    expect(pageText(pages[0])).not.toContain('Vigencia');
  });
});

describe('renderReceiptPdf — pagination and long text', () => {
  const fourteen = Array.from({ length: 14 }, (_, i) =>
    item(i + 1, {
      name: `Mantenimiento preventivo ${i + 1}`,
      description: i % 2 ? 'Limpieza de filtros y revisión de gas' : '',
      quantity: 1,
      unitPrice: 450,
      amount: 450,
    }),
  );

  it('paginates 14 items to 2 pages with repeated headers and totals and footer on the last page', () => {
    const { pages } = render(
      'presupuesto-14-items',
      presupuesto({ items: fourteen, itemCount: 14, subtotal: 6300, total: 6300, bigFigure: { label: 'Total del presupuesto', value: 6300 } }),
    );

    expect(pages).toHaveLength(2);
    const [first, second] = pages.map(pageText);
    for (const text of [first, second]) {
      expect(text).toContain('PRESUPUESTO');
      expect(text).toContain('CONCEPTO CANTIDAD PRECIO UNITARIO IMPORTE');
    }
    expect(first).toContain('PRESUPUESTO 001114 · Página 1 de 2');
    expect(second).toContain('PRESUPUESTO 001114 · Página 2 de 2');
    expect(first).not.toMatch(/Subtotal|TELÉFONO|Total del presupuesto/);
    expectInOrder(pages[1], ['14', 'Mantenimiento preventivo 14', 'Subtotal', 'Total del presupuesto', '$6,300.00 MXN', 'TELÉFONO']);

    const names = pages.flatMap((page) =>
      page.runs.filter((run) => run.text.startsWith('Mantenimiento preventivo')).map((run) => run.text),
    );
    expect(names).toEqual(fourteen.map((entry) => entry.name));
  });

  it('wraps long names to 2 lines and descriptions to 3 with an ellipsis', () => {
    const longName =
      'Instalación completa de minisplit inverter de 2 toneladas con kit de tubería de cobre, soportes y bomba de condensados';
    const longDescription = Array.from({ length: 12 }, () => 'Incluye vacío, carga de gas y pruebas.').join(' ');
    const { pages } = render(
      'presupuesto-long-text',
      presupuesto({ items: [item(1, { name: longName, description: longDescription })], itemCount: 1 }),
    );

    const row = pages[0].runs.filter((run) => run.font === 'PlexSans-SemiBold' && run.size === 10.5 && run.x < 100);
    expect(row).toHaveLength(2);
    expect(row[1].text.endsWith('…')).toBe(true);
    const description = pages[0].runs.filter((run) => run.size === 9.375);
    expect(description).toHaveLength(3);
    expect(description[2].text.endsWith('…')).toBe(true);
  });

  it('never prints a numeric column over its neighbour for wide amounts', () => {
    const { pages } = render(
      'presupuesto-wide-amounts',
      presupuesto({
        items: [item(1, { quantity: 12.5, unitPrice: 123456.78, amount: 1543209.75 })],
        itemCount: 1,
        subtotal: 1543209.75,
        total: 1543209.75,
        bigFigure: { label: 'Total del presupuesto', value: 1543209.75 },
      }),
    );
    const price = pages[0].runs.find((run) => run.text === '$123,456.78 MXN');
    const amount = pages[0].runs.filter((run) => run.text === '$1,543,209.75 MXN')[0];
    expect(price && amount).toBeTruthy();
    // 13px mono = 7.8px = 5.85pt per char; at least 12pt (16px) of air between columns.
    expect(amount!.x - (price!.x + '$123,456.78 MXN'.length * 5.85)).toBeGreaterThanOrEqual(12 - 0.01);
  });
});

describe('renderReceiptPdf — logo', () => {
  it.each([
    ['none', null],
    ['wide', solidPng(400, 40)],
    ['tall', solidPng(40, 400)],
    ['tiny', ONE_PX_PNG],
    ['invalid', 'data:image/png;base64,not-a-real-image'],
    ['unsupported', 'data:image/gif;base64,R0lGODlhAQABAAAAACw='],
  ])('renders with a %s logo', (name, logo) => {
    const { bytes, pages } = render(`logo-${name}`, recibo(), logo);
    expect(Buffer.from(bytes).subarray(0, 5).toString('ascii')).toBe('%PDF-');
    expect(pageText(pages[0])).toContain('ClimaTotal Demo');
  });

  it('draws the initial circle only without a usable logo', () => {
    expect(render('logo-initial', recibo()).pages[0].runs.some((run) => run.text === 'C')).toBe(true);
    expect(render('logo-image', recibo(), solidPng(400, 40)).pages[0].runs.some((run) => run.text === 'C')).toBe(false);
  });

  it('scales the logo into 160×44 px without stretching', () => {
    const source = renderReceiptPdf(recibo(), { logoDataUrl: solidPng(400, 40), compress: false });
    const pdf = Buffer.from(source).toString('latin1');
    // Image placement: `w 0 0 h x y cm` in pt. 400×40 → 160×16 px → 120×12 pt.
    const placement = pdf.match(/([\d.]+) 0\.? 0\.? ([\d.]+) [\d.]+ [\d.]+ cm\s*\/I/);
    expect(placement).not.toBeNull();
    expect(Number(placement![1])).toBeCloseTo(120, 1);
    expect(Number(placement![2])).toBeCloseTo(12, 1);
  });
});
