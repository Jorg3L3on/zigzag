import {
  ASSISTANT_PAGE_PATH,
  getWrittenGuide,
  getWrittenGuides,
  filterHelpCards,
  getHelpCards,
  getNextGuide,
  GUIDES,
  slugifyTitle,
  topicHref,
  type Guide,
  type GuideContent,
} from '@/components/ayuda/guide-registry';

const CONTENT: GuideContent = { description: 'd', intro: 'i', steps: [] };

const written = (guide: Guide): Guide => ({ ...guide, content: CONTENT });

describe('guide registry (ZIG-I40)', () => {
  it('has the sixteen guides with kebab-case slugs of their titles, unique', () => {
    expect(GUIDES).toHaveLength(16);
    for (const guide of GUIDES) {
      expect(guide.slug).toBe(slugifyTitle(guide.title));
    }
    expect(new Set(GUIDES.map((guide) => guide.slug)).size).toBe(16);
    expect(slugifyTitle('Trabajar sin señal')).toBe('trabajar-sin-senal');
    expect(slugifyTitle('Elegir qué ve cada quien')).toBe('elegir-que-ve-cada-quien');
  });

  it('shows a card only for written guides, and the connector only once its page is ready', () => {
    const guides = [written(GUIDES[0]), GUIDES[1]];
    expect(getHelpCards(guides, false).map((card) => card.key)).toEqual([GUIDES[0].slug]);
    const withConnector = getHelpCards(guides, true);
    expect(withConnector.map((card) => card.href)).toEqual([
      `/ayuda/${GUIDES[0].slug}`,
      ASSISTANT_PAGE_PATH,
    ]);
    expect(withConnector[1].title).toBe('Conectar ChatGPT, Claude o Grok');
  });

  it('filters cards by group and title, ignoring case and accents', () => {
    const cards = getHelpCards(GUIDES.map(written), true);
    expect(cards).toHaveLength(17);
    expect(filterHelpCards(cards, '').length).toBe(17);
    expect(filterHelpCards(cards, 'TELEFONO').map((card) => card.group)).toEqual([
      'Teléfono',
      'Teléfono',
      'Teléfono',
    ]);
    expect(filterHelpCards(cards, 'sin señal').map((card) => card.title)).toEqual([
      'Trabajar sin señal',
    ]);
    expect(filterHelpCards(cards, 'recibo whatsapp').map((card) => card.key)).toEqual([
      'mandar-el-recibo-por-whatsapp',
    ]);
    expect(filterHelpCards(cards, 'zzz')).toEqual([]);
  });

  it('topic links go to the first written guide of the topic, else /ayuda', () => {
    const guides = GUIDES.map((guide) =>
      guide.slug === 'ver-quien-me-debe' ? written(guide) : { ...guide, content: undefined },
    );
    expect(topicHref('cobro', guides)).toBe('/ayuda/ver-quien-me-debe');
    expect(topicHref('equipo', guides)).toBe('/ayuda');
    expect(topicHref('asistentes', guides)).toBe(ASSISTANT_PAGE_PATH);
  });

  it('next guide: preferred if written, else the next written one, else none', () => {
    const [a, b, c] = GUIDES;
    const prefersC = { ...a, content: { ...CONTENT, next: c.slug } };
    expect(getNextGuide(a.slug, [prefersC, written(b), written(c)])?.slug).toBe(c.slug);
    expect(getNextGuide(a.slug, [prefersC, written(b), c])?.slug).toBe(b.slug);
    expect(getNextGuide(a.slug, [prefersC, b, c])).toBeNull();
  });

  it('every written guide has a card on /ayuda, and no card is hidden', () => {
    const cards = getHelpCards(GUIDES, false);
    expect(cards.map((card) => card.key)).toEqual(getWrittenGuides().map((guide) => guide.slug));
    for (const guide of getWrittenGuides()) {
      expect(cards.find((card) => card.key === guide.slug)?.href).toBe(`/ayuda/${guide.slug}`);
    }
  });

  describe('part 2 guides (ZIG-I40-4)', () => {
    const PART_2 = [
      'guardar-un-cliente',
      'armar-mi-lista-de-precios',
      'programar-un-mantenimiento',
      'instalar-zigzag-en-mi-telefono',
      'trabajar-sin-senal',
      'poner-el-texto-grande',
      'invitar-a-mi-equipo',
      'elegir-que-ve-cada-quien',
    ];

    it.each(PART_2)('%s is written, has a card, 3–6 steps and a piece on every step', (slug) => {
      const guide = getWrittenGuide(slug);
      expect(guide).not.toBeNull();
      expect(getHelpCards().map((card) => card.key)).toContain(slug);
      const { steps, next } = guide!.content;
      expect(steps.length).toBeGreaterThanOrEqual(3);
      expect(steps.length).toBeLessThanOrEqual(6);
      for (const step of steps) {
        expect(step.title.trim()).not.toBe('');
        expect(step.body.trim()).not.toBe('');
        expect(step.piece.kind).toBeTruthy();
      }
      if (next) expect(GUIDES.map((item) => item.slug)).toContain(next);
    });
  });
});
