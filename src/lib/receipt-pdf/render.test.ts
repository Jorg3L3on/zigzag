/**
 * @jest-environment node
 */
import fs from 'node:fs';
import path from 'node:path';
import type { ReceiptPdfItem, ReceiptPdfPayload } from '@/lib/receipt-pdf/payload';
import { renderReceiptPdf, type ReceiptPdfLayoutMetrics } from '@/lib/receipt-pdf/render';
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
  serviceAmount: overrides.amount ?? 100,
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
  notes: null,
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

  it('grows the row to print long names and descriptions in full (ZIG-I12)', () => {
    const longName =
      'Instalación completa de minisplit inverter de 2 toneladas con kit de tubería de cobre, soportes y bomba de condensados';
    const longDescription = Array.from({ length: 12 }, () => 'Incluye vacío, carga de gas y pruebas.').join(' ');
    const { pages } = render(
      'presupuesto-long-text',
      presupuesto({ items: [item(1, { name: longName, description: longDescription })], itemCount: 1 }),
    );

    const squash = (value: string) => value.replace(/\s+/g, '');
    const nameRuns = pages[0].runs.filter((run) => run.font === 'PlexSans-SemiBold' && run.size === 10.5 && run.x < 100);
    expect(nameRuns.length).toBeGreaterThanOrEqual(2);
    expect(squash(nameRuns.map((run) => run.text).join(''))).toBe(squash(longName));
    const description = pages[0].runs.filter((run) => run.size === 9.375);
    expect(description.length).toBeGreaterThan(3);
    expect(squash(description.map((run) => run.text).join(''))).toBe(squash(longDescription));
    expect(pageText(pages[0])).not.toContain('…');
  });

  it('breaks a 100-char unbroken name by characters inside the Concepto column', () => {
    const name = 'X'.repeat(100);
    let metrics: ReceiptPdfLayoutMetrics | undefined;
    const bytes = renderReceiptPdf(
      presupuesto({ items: [item(1, { name })], itemCount: 1 }),
      { compress: false, onLayout: (value) => (metrics = value) },
    );
    const pages = extractPdfText(bytes);
    const parts = pages[0].runs.filter((run) => run.font === 'PlexSans-SemiBold' && run.size === 10.5 && run.x < 100);

    expect(parts.length).toBeGreaterThan(1);
    expect(parts.map((run) => run.text).join('')).toBe(name);
    // 10.5pt Plex Sans caps average ~7pt: no part may run past the Concepto column.
    const conceptRightPt = (48 + metrics!.conceptWidth) * 0.75;
    for (const part of parts) expect(part.x + part.text.length * 5.5).toBeLessThan(conceptRightPt);
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

describe('renderReceiptPdf — documents without materials', () => {
  const normalizedHash = (bytes: ArrayBuffer) =>
    jest
      .requireActual<typeof import('node:crypto')>('node:crypto')
      .createHash('sha256')
      .update(
        Buffer.from(bytes)
          .toString('latin1')
          .replace(/\/CreationDate \([^)]*\)/, '')
          .replace(/\/ID \[[^\]]*\]/, ''),
      )
      .digest('hex');

  it('prints exactly what phase 2 printed (ZIG-I11-4 regression guard)', () => {
    const hashes = {
      recibo: normalizedHash(renderReceiptPdf(recibo(), { compress: false })),
      presupuesto: normalizedHash(renderReceiptPdf(presupuesto(), { compress: false })),
      adjustment: normalizedHash(
        renderReceiptPdf(
          recibo({ adjustment: -25, total: 300, balanceDue: 200, bigFigure: { label: 'Saldo por pagar', value: 200 } }),
          { compress: false },
        ),
      ),
    };
    // Hashes of the phase 2 renderer output (CreationDate and ID stripped).
    expect(hashes).toEqual({
      recibo: '44932b1149f4eb1cc56508c7abb289fc68e1bedd4c93c7da4ce0541393035c2e',
      presupuesto: '5e3901252f6332eb9ed8f55c59dd9d15caf2d83a53d853abe915c4b6d60c58b2',
      adjustment: 'f9fe044f419038f82175498ab1997f0e16542705510a23fed98771a4776170f9',
    });
  });
});

describe('renderReceiptPdf — materials (ZIG-I10)', () => {
  const material = (name: string, quantity: number, unit: string | null, unitPrice: number) => ({
    name,
    quantity,
    unit,
    unitPrice,
    amount: Math.round(quantity * unitPrice * 100) / 100,
  });
  const withMaterials = (n: number, materials: ReturnType<typeof material>[], serviceAmount = 1200) =>
    item(n, {
      name: `Instalación ${n}`,
      description: 'Minisplit 1 tonelada',
      unitPrice: serviceAmount,
      serviceAmount,
      materials,
      amount: Math.round((serviceAmount + materials.reduce((sum, m) => sum + m.amount, 0)) * 100) / 100,
    });

  it('prints each material under its concept with qty, unit, price and amount', () => {
    const concept = withMaterials(1, [
      material('Tubería de cobre 1/4', 3, 'm', 85),
      material('Gas R410A', 2, 'kg', 450),
      material('Cinta', 1, null, 35),
    ]);
    const { pages } = render(
      'presupuesto-materials',
      presupuesto({
        items: [concept],
        itemCount: 1,
        servicesSubtotal: 1200,
        materialsSubtotal: 1190,
        subtotal: 2390,
        total: 2390,
        bigFigure: { label: 'Total del presupuesto', value: 2390 },
      }),
    );

    expectInOrder(pages[0], [
      'Instalación 1',
      'Minisplit 1 tonelada',
      '1',
      '$1,200.00 MXN',
      '$2,390.00 MXN',
      '· Tubería de cobre 1/4',
      '3 m',
      '$85.00 MXN',
      '$255.00 MXN',
      '· Gas R410A',
      '2 kg',
      '$450.00 MXN',
      '$900.00 MXN',
      '· Cinta',
      '1',
      '$35.00 MXN',
      '$35.00 MXN',
      'Servicios',
      '$1,200.00 MXN',
      'Materiales',
      '$1,190.00 MXN',
      'Subtotal',
      '$2,390.00 MXN',
      'Total',
    ]);
    const run = (text: string) => pages[0].runs.find((entry) => entry.text === text);
    expect(run('· Gas R410A')).toMatchObject({ font: 'PlexSans-Regular', size: 9 });
    expect(run('2 kg')).toMatchObject({ font: 'PlexMono-Regular', size: 9 });
    expect(pages[0].runs.filter((entry) => entry.text === '$900.00 MXN')).toEqual([
      expect.objectContaining({ font: 'PlexMono-Regular', size: 9 }),
    ]);
    // The concept's Importe (13px / 500) includes its materials.
    expect(run('$2,390.00 MXN')).toMatchObject({ font: 'PlexMono-Medium', size: 9.75 });
  });

  it('mixes concepts with and without materials; Servicios + Materiales = Subtotal', () => {
    const { pages } = render(
      'recibo-mixed-materials',
      recibo({
        items: [
          withMaterials(1, [material('Gas R410A', 1, 'kg', 450)], 800),
          item(2, { name: 'Diagnóstico', unitPrice: 300, amount: 300, serviceAmount: 300 }),
        ],
        itemCount: 2,
        servicesSubtotal: 1100,
        materialsSubtotal: 450,
        subtotal: 1550,
        total: 1550,
        paid: 0,
        balanceDue: 1550,
        bigFigure: { label: 'Saldo por pagar', value: 1550 },
      }),
    );
    expectInOrder(pages[0], ['Instalación 1', '· Gas R410A', 'Diagnóstico', 'Servicios', '$1,100.00 MXN', 'Materiales', '$450.00 MXN', 'Subtotal', '$1,550.00 MXN']);
    expect(pages[0].runs.filter((entry) => entry.text.startsWith('· '))).toHaveLength(1);
  });

  it('paginates 10 concepts × 2 materials without overlap', () => {
    const items = Array.from({ length: 10 }, (_, i) =>
      withMaterials(i + 1, [material('Gas R410A', 1, 'kg', 450), material('Tubería', 2, 'm', 85)]),
    );
    const { pages } = render(
      'presupuesto-10x2-materials',
      presupuesto({
        items,
        itemCount: 10,
        servicesSubtotal: 12000,
        materialsSubtotal: 6200,
        subtotal: 18200,
        total: 18200,
        bigFigure: { label: 'Total del presupuesto', value: 18200 },
      }),
    );

    expect(pages.length).toBeGreaterThanOrEqual(2);
    // Every concept keeps its materials on the same page, right after it.
    for (const page of pages) {
      const texts = page.runs.map((entry) => entry.text);
      texts.forEach((text, i) => {
        if (/^Instalación \d+$/.test(text)) {
          expect(texts.slice(i).indexOf('· Tubería')).toBeGreaterThan(0);
        }
      });
      // Runs never go below the colophon line or above the page top.
      for (const entry of page.runs) {
        expect(entry.y).toBeGreaterThan(30);
        expect(entry.y).toBeLessThan(792 - 40);
      }
    }
    const lastPage = pageText(pages[pages.length - 1]);
    expect(lastPage).toContain('Servicios');
    expect(lastPage).toContain('TELÉFONO');
    expect(pages.flatMap((page) => page.runs.filter((entry) => entry.text === '· Gas R410A'))).toHaveLength(10);
  });
});

describe('renderReceiptPdf — tagline (ZIG-I11-3)', () => {
  it('prints the tagline under the company name and omits it cleanly when empty', () => {
    const withTagline = extractPdfText(renderReceiptPdf(presupuesto()))[0];
    expectInOrder(withTagline, ['ClimaTotal Demo', 'Climatización · Servicio técnico', 'PRESUPUESTO']);

    const bare = presupuesto({ company: { ...presupuesto().company, tagline: null } });
    const without = extractPdfText(renderReceiptPdf(bare))[0];
    expect(pageText(without)).not.toContain('Climatización');
    // The name moves down to stay centered on the 44px mark: one line, no gap left for a tagline.
    const nameWith = withTagline.runs.find((run) => run.text === 'ClimaTotal Demo')!;
    const nameWithout = without.runs.find((run) => run.text === 'ClimaTotal Demo')!;
    expect(nameWithout.y).toBeLessThan(nameWith.y);
  });
});

describe('renderReceiptPdf — notes and conditions (ZIG-I12)', () => {
  const lines = (page: PdfTextPage, size: number) => page.runs.filter((run) => run.size === size);

  it('prints Condiciones y notas after the totals on a presupuesto', () => {
    const { pages } = render(
      'presupuesto-notes',
      presupuesto({ notes: '50% anticipo, saldo contra entrega.\n\nEl cliente compra el equipo.' }),
    );

    expect(pages).toHaveLength(1);
    expectInOrder(pages[0], [
      'Total del presupuesto',
      'CONDICIONES Y NOTAS',
      '50% anticipo, saldo contra entrega.',
      'El cliente compra el equipo.',
      'TELÉFONO',
    ]);
    // The paragraph gap is half a line: the two paragraphs are not adjacent lines.
    const [first, second] = lines(pages[0], 9.375);
    expect(first.y - second.y).toBeGreaterThan(0);
  });

  it('labels a recibo block Notas', () => {
    const { pages } = render('recibo-notes', recibo({ notes: 'Cambio de capacitor.' }));
    const text = pageText(pages[0]);
    expect(text).toContain('NOTAS');
    expect(text).not.toContain('CONDICIONES Y NOTAS');
  });

  it('prints no notes block without notes', () => {
    const { pages } = render('presupuesto-no-notes', presupuesto());
    expect(pageText(pages[0])).not.toContain('NOTAS');
  });

  it('paginates a 2,000-char note without losing a word or touching the footer', () => {
    const sentence = 'Garantía de 30 días en mano de obra y 6 meses en refacciones nuevas.';
    const notes = Array.from({ length: 29 }, () => sentence).join(' ').slice(0, 2000);
    const { pages } = render(
      'presupuesto-long-notes',
      presupuesto({ notes, items: [item(1)], itemCount: 1 }),
    );

    const body = pages.flatMap((page) => lines(page, 9.375)).map((run) => run.text).join(' ');
    expect(body.replace(/\s+/g, ' ')).toBe(notes.replace(/\s+/g, ' ').trim());
    const last = pages[pages.length - 1];
    const footerLabel = last.runs.find((run) => run.text === 'TELÉFONO');
    const lastNote = lines(last, 9.375).at(-1);
    expect(footerLabel).toBeTruthy();
    // PDF y grows upward: the last note line sits above the footer label.
    expect(lastNote!.y).toBeGreaterThan(footerLabel!.y);
  });

  it('can start the notes on a fresh page, repeating the header without the table', () => {
    // Somewhere between a nearly empty and a full page the totals leave no room for the notes.
    const notesOnlyPage = [6, 7, 8, 9, 10, 11].map((count) => {
      const many = Array.from({ length: count }, (_, index) => item(index + 1, { name: `Servicio ${index + 1}` }));
      const { pages } = render(
        `presupuesto-notes-next-page-${count}`,
        presupuesto({ items: many, itemCount: count, notes: 'Condición uno.\nCondición dos.\nCondición tres.' }),
      );
      return pages.find((page) => pageText(page).includes('Condición uno.') && !pageText(page).includes('CONCEPTO CANTIDAD'));
    });

    const found = notesOnlyPage.find(Boolean);
    expect(found).toBeTruthy();
    const text = pageText(found as PdfTextPage);
    expect(text).toContain('PRESUPUESTO');
    expect(text).toContain('CONDICIONES Y NOTAS');
    expect(text).toContain('TELÉFONO');
  });
});

describe('renderReceiptPdf — wide amounts and units (ZIG-I12)', () => {
  const layoutOf = (payload: ReceiptPdfPayload, name: string) => {
    let metrics: ReceiptPdfLayoutMetrics | undefined;
    const bytes = renderReceiptPdf(payload, { compress: false, onLayout: (value) => (metrics = value) });
    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(path.join(OUT_DIR, `${name}.pdf`), Buffer.from(bytes));
    return { metrics: metrics as ReceiptPdfLayoutMetrics, pages: extractPdfText(bytes) };
  };

  const bigItem = item(1, {
    name: 'Servicio grande',
    quantity: 99,
    unitPrice: 99_999_990,
    amount: 9_899_999_010,
    serviceAmount: 9_899_999_010,
  });
  const bigPayload = () =>
    presupuesto({
      items: [bigItem],
      itemCount: 1,
      servicesSubtotal: 9_899_999_010,
      subtotal: 9_899_999_010,
      total: 9_899_999_010,
      bigFigure: { label: 'Total del presupuesto', value: 9_899_999_010 },
    });

  it('keeps the design layout for ordinary amounts', () => {
    const { metrics } = layoutOf(presupuesto(), 'layout-ordinary');
    expect(metrics.compactAmounts).toBe(false);
    expect(metrics.numberScale).toBe(1);
    expect(metrics.priceWidth).toBe(130);
    expect(metrics.amountWidth).toBe(120);
  });

  it('keeps Concepto at 45% of the table with 10-digit amounts', () => {
    const { metrics, pages } = layoutOf(bigPayload(), 'layout-wide');

    expect(metrics.conceptWidth).toBeGreaterThanOrEqual(688 * 0.45 - 0.01);
    expect(metrics.compactAmounts).toBe(true);
    // The row still prints the exact amounts (currency code only in totals).
    const text = pageText(pages[0]);
    expect(text).toContain('$99,999,990.00');
    expect(text).toContain('$9,899,999,010.00 MXN');
  });

  it('puts a long unit under the quantity instead of spilling into Concepto', () => {
    const unit = 'u'.repeat(20);
    const payload = presupuesto({
      items: [
        item(1, {
          materials: [{ name: 'Tubo', quantity: 9999.99, unit, unitPrice: 1, amount: 9999.99 }],
        }),
      ],
      itemCount: 1,
      materialsSubtotal: 9999.99,
    });
    const { metrics, pages } = layoutOf(payload, 'layout-long-unit');

    const unitRuns = pages[0].runs.filter((run) => /^u+$/.test(run.text));
    expect(unitRuns.length).toBeGreaterThan(0);
    expect(metrics.qtyWidth).toBeLessThanOrEqual(120);
    const qtyLeftPt = (48 + metrics.conceptWidth) * 0.75;
    for (const run of unitRuns) expect(run.x).toBeGreaterThanOrEqual(qtyLeftPt - 0.5);
  });

  it('scales the big figure to fit its panel', () => {
    const { pages } = layoutOf(
      recibo({
        items: [bigItem],
        itemCount: 1,
        total: 9_899_999_010,
        subtotal: 9_899_999_010,
        paid: 0,
        balanceDue: 9_899_999_010,
        bigFigure: { label: 'Saldo por pagar', value: 9_899_999_010 },
      }),
      'layout-big-figure',
    );
    const figure = pages[0].runs.find((run) => run.text === '$9,899,999,010.00 MXN' && run.size > 12);
    expect(figure).toBeTruthy();
    // 24px design size is 18pt: it shrank, and its left edge stays inside the 320px panel.
    expect(figure!.size).toBeLessThan(18);
    expect(figure!.x).toBeGreaterThanOrEqual((816 - 64 - 320) * 0.75);
  });
});

describe('renderReceiptPdf — unsupported characters and status (ZIG-I12)', () => {
  it('draws no stray glyph for names the fonts cannot print', () => {
    const { pages } = render(
      'presupuesto-glyphs',
      presupuesto({ items: [item(1, { name: 'Urgente', description: 'Multilenguaje: , , русский' })], itemCount: 1 }),
    );
    expect(pageText(pages[0])).not.toContain('�');
    expect(pageText(pages[0])).toContain('русский');
  });

  it('prints the Pago parcial pill on a partially paid recibo', () => {
    const { pages } = render(
      'recibo-parcial',
      recibo({ recibo: { statusLabel: 'Pago parcial', paidOnDate: null } }),
    );
    expect(pageText(pages[0])).toContain('PAGO PARCIAL');
  });
});
