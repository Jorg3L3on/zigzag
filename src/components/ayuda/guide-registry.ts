import type { Part1PieceSpec } from '@/components/ayuda/pieces/part-1-pieces';
import { GUIDES_PART_1_CONTENT } from '@/components/ayuda/guides/part-1';
import { AYUDA_PATH } from '@/lib/marketing-routes';

/**
 * Help centre guides (ZIG-I40): the ONE list behind the /ayuda cards, the
 * /ayuda/<slug> pages, the topic links and the sitemap. A guide without
 * `content` is not written yet: no card, no page, no sitemap entry.
 */

export type HelpTopicKey =
  | 'tickets'
  | 'cobro'
  | 'presupuestos'
  | 'clientes-y-servicios'
  | 'telefono'
  | 'equipo'
  | 'asistentes';

export type HelpTopic = { key: HelpTopicKey; label: string };

/** Topic links on every guide page, in this order. */
export const HELP_TOPICS: HelpTopic[] = [
  { key: 'tickets', label: 'Tickets' },
  { key: 'cobro', label: 'Cobro' },
  { key: 'presupuestos', label: 'Presupuestos' },
  { key: 'clientes-y-servicios', label: 'Clientes y servicios' },
  { key: 'telefono', label: 'Teléfono' },
  { key: 'equipo', label: 'Equipo' },
  { key: 'asistentes', label: 'Asistentes IA' },
];

/** Connector page for ChatGPT, Claude and Grok (built by its own ticket). */
export const ASSISTANT_PAGE_PATH = `${AYUDA_PATH}/asistentes`;

/**
 * Flip to true once /ayuda/asistentes exists: until then its card stays off
 * /ayuda (the top bar and topic links point at it regardless).
 */
export const ASSISTANT_PAGE_READY = false;

/** A rebuilt piece of the app shown next to a step (see `pieces/`). */
export type GuidePiece =
  | { kind: 'bottom-dock' }
  | { kind: 'client-card'; name: string; phone: string; dateLabel: string }
  | {
      kind: 'services-list';
      lines: Array<{ name: string; amount: number }>;
    }
  | {
      kind: 'payment-choice';
      /** Option selected when the page loads. */
      initial: 'full' | 'partial' | 'pending';
      /** What happens to the ticket for each option, read back under the chips. */
      explanations: Record<'full' | 'partial' | 'pending', string>;
    }
  | { kind: 'save-bar'; countLabel: string; total: number; label: string }
  | Part1PieceSpec;

export type GuideStep = {
  title: string;
  body: string;
  piece: GuidePiece;
};

export type GuideContent = {
  /** Meta description for the page. */
  description: string;
  intro: string;
  steps: GuideStep[];
  /** Optional dashed note under the steps. */
  note?: { title: string; body: string };
  /** Preferred next guide; falls back to the next written one, then /ayuda. */
  next?: string;
};

export type Guide = {
  slug: string;
  /** Card eyebrow on /ayuda (also searched). */
  group: string;
  title: string;
  topic: HelpTopicKey;
  content?: GuideContent;
};

/** Registry order is the card order on /ayuda and the fallback "Sigue" order. */
export const GUIDES: Guide[] = [
  {
    slug: 'crear-un-ticket',
    group: 'Tickets',
    title: 'Crear un ticket',
    topic: 'tickets',
    // Copy checked against the composer, dock and PaymentChoice source (ZIG-I40-2).
    content: {
      description:
        'Cómo crear un ticket en ZigZag en cinco pasos: cliente, servicios, cómo te pagó y Guardar.',
      intro:
        'Un ticket es un trabajo: a quién se lo hiciste, qué le hiciste y cuánto te pagó. Se hace igual en el teléfono y en la computadora.',
      steps: [
        {
          title: 'Toca el botón +',
          body: 'Está en medio de la barra de abajo. Tócalo y elige “Nuevo ticket”. En la computadora, en Tickets, es el botón azul “Nuevo ticket”.',
          piece: { kind: 'bottom-dock' },
        },
        {
          title: 'Elige al cliente',
          body: 'Toca “Busca o elige un cliente”, escribe su nombre o su teléfono y tócalo en la lista. Si es nuevo, toca “Nuevo cliente”. Si te equivocas, toca “Cambiar”.',
          piece: {
            kind: 'client-card',
            name: 'Hotel Riviera Dorada',
            phone: '998 123 4567',
            dateLabel: 'Hoy, 12 nov',
          },
        },
        {
          title: 'Agrega lo que hiciste',
          body: 'Toca “Agregar servicio”, elige uno de tu lista de precios y toca “Agregar al ticket”. Repite por cada servicio. ZigZag hace la suma.',
          piece: {
            kind: 'services-list',
            lines: [
              { name: 'Mantenimiento preventivo A/C', amount: 850 },
              { name: 'Recarga de gas refrigerante', amount: 1400 },
            ],
          },
        },
        {
          title: 'Di cómo te pagó',
          body: 'Si ya terminaste el trabajo, elige Todo, Una parte o Nada aún. Si no eliges nada, el ticket se guarda En proceso. Pruébalo aquí: toca una opción y mira qué pasa con el ticket.',
          piece: {
            kind: 'payment-choice',
            initial: 'partial',
            explanations: {
              full: 'El ticket se termina al guardar y queda Pagado.',
              partial:
                'Escribes cuánto te pagó. El ticket se termina al guardar y lo que falta queda por cobrar en Cobranza.',
              pending:
                'El ticket se termina al guardar sin pago y queda Por cobrar en Cobranza hasta que te pague.',
            },
          },
        },
        {
          title: 'Toca Guardar',
          body: 'Listo: el ticket queda con su folio. Si elegiste cómo te pagó, el botón dice “Terminar” (en la computadora, “Guardar y terminar”) y al final te ofrece mandar el recibo.',
          piece: { kind: 'save-bar', countLabel: '2 servicios', total: 2250, label: 'Guardar' },
        },
      ],
      note: {
        title: '¿No hay señal?',
        body: 'Guárdalo igual. El ticket se queda en tu teléfono y se sube solo cuando vuelve la señal; hasta entonces no tiene folio.',
      },
      next: 'mandar-el-recibo-por-whatsapp',
    },
  },
  {
    slug: 'agregar-materiales-a-un-ticket',
    group: 'Tickets',
    title: 'Agregar materiales a un ticket',
    topic: 'tickets',
  },
  { slug: 'terminar-un-ticket', group: 'Tickets', title: 'Terminar un ticket', topic: 'tickets' },
  {
    slug: 'anotar-un-pago-o-un-anticipo',
    group: 'Cobro',
    title: 'Anotar un pago o un anticipo',
    topic: 'cobro',
  },
  { slug: 'ver-quien-me-debe', group: 'Cobro', title: 'Ver quién me debe', topic: 'cobro' },
  {
    slug: 'mandar-el-recibo-por-whatsapp',
    group: 'Cobro',
    title: 'Mandar el recibo por WhatsApp',
    topic: 'cobro',
  },
  {
    slug: 'hacer-un-presupuesto',
    group: 'Presupuestos',
    title: 'Hacer un presupuesto',
    topic: 'presupuestos',
  },
  {
    slug: 'convertir-un-presupuesto-a-ticket',
    group: 'Presupuestos',
    title: 'Convertir un presupuesto a ticket',
    topic: 'presupuestos',
  },
  {
    slug: 'guardar-un-cliente',
    group: 'Clientes',
    title: 'Guardar un cliente',
    topic: 'clientes-y-servicios',
  },
  {
    slug: 'armar-mi-lista-de-precios',
    group: 'Servicios',
    title: 'Armar mi lista de precios',
    topic: 'clientes-y-servicios',
  },
  {
    slug: 'programar-un-mantenimiento',
    group: 'Recordatorios',
    title: 'Programar un mantenimiento',
    topic: 'clientes-y-servicios',
  },
  {
    slug: 'instalar-zigzag-en-mi-telefono',
    group: 'Teléfono',
    title: 'Instalar ZigZag en mi teléfono',
    topic: 'telefono',
  },
  { slug: 'trabajar-sin-senal', group: 'Teléfono', title: 'Trabajar sin señal', topic: 'telefono' },
  {
    slug: 'poner-el-texto-grande',
    group: 'Teléfono',
    title: 'Poner el texto grande',
    topic: 'telefono',
  },
  { slug: 'invitar-a-mi-equipo', group: 'Equipo', title: 'Invitar a mi equipo', topic: 'equipo' },
  {
    slug: 'elegir-que-ve-cada-quien',
    group: 'Equipo',
    title: 'Elegir qué ve cada quien',
    topic: 'equipo',
  },
];

// ZIG-I40-3: tickets, cobro and presupuestos guides live in guides/part-1.ts.
for (const guide of GUIDES) guide.content ??= GUIDES_PART_1_CONTENT[guide.slug];

export type WrittenGuide = Guide & { content: GuideContent };

export const isWritten = (guide: Guide): guide is WrittenGuide => guide.content !== undefined;

export const guideHref = (slug: string) => `${AYUDA_PATH}/${slug}`;

/** Lowercase, accents removed: "Teléfono" and "telefono" match. */
export const foldForSearch = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

/** Kebab-case of a title without accents ("Ver quién me debe" → ver-quien-me-debe). */
export const slugifyTitle = (title: string) =>
  foldForSearch(title)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const getWrittenGuides = (guides: Guide[] = GUIDES): WrittenGuide[] =>
  guides.filter(isWritten);

export const getWrittenGuide = (slug: string, guides: Guide[] = GUIDES): WrittenGuide | null =>
  getWrittenGuides(guides).find((guide) => guide.slug === slug) ?? null;

export type HelpCard = { key: string; group: string; title: string; href: string };

/** Cards on /ayuda: written guides, plus the connector once its page exists. */
export const getHelpCards = (
  guides: Guide[] = GUIDES,
  assistantPageReady: boolean = ASSISTANT_PAGE_READY,
): HelpCard[] => [
  ...getWrittenGuides(guides).map((guide) => ({
    key: guide.slug,
    group: guide.group,
    title: guide.title,
    href: guideHref(guide.slug),
  })),
  ...(assistantPageReady
    ? [
        {
          key: 'asistentes',
          group: 'Asistentes IA',
          title: 'Conectar ChatGPT, Claude o Grok',
          href: ASSISTANT_PAGE_PATH,
        },
      ]
    : []),
];

/** Search on /ayuda: every word must appear in "group title" (case and accents ignored). */
export const filterHelpCards = (cards: HelpCard[], query: string): HelpCard[] => {
  const words = foldForSearch(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return cards;
  return cards.filter((card) => {
    const haystack = foldForSearch(`${card.group} ${card.title}`);
    return words.every((word) => haystack.includes(word));
  });
};

/**
 * Where a topic link goes: the connector page for Asistentes IA, else the
 * first written guide of the topic, else the guide index.
 */
export const topicHref = (topic: HelpTopicKey, guides: Guide[] = GUIDES): string => {
  if (topic === 'asistentes') return ASSISTANT_PAGE_PATH;
  const first = getWrittenGuides(guides).find((guide) => guide.topic === topic);
  return first ? guideHref(first.slug) : AYUDA_PATH;
};

/** "Sigue": the preferred next guide if written, else the next written one in order, else null. */
export const getNextGuide = (slug: string, guides: Guide[] = GUIDES): WrittenGuide | null => {
  const current = guides.find((guide) => guide.slug === slug);
  const preferred = current?.content?.next ? getWrittenGuide(current.content.next, guides) : null;
  if (preferred) return preferred;
  const index = guides.findIndex((guide) => guide.slug === slug);
  return guides.slice(index + 1).find(isWritten) ?? null;
};
