import {
  ASSISTANT_PAGE_PATH,
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

/** The registry as if nothing were written yet, so these tests do not depend on which guides are. */
const unwritten = (guide: Guide): Guide => ({ ...guide, content: undefined });

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
    const guides = [written(GUIDES[0]), unwritten(GUIDES[1])];
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
      guide.slug === 'ver-quien-me-debe' ? written(guide) : unwritten(guide),
    );
    expect(topicHref('cobro', guides)).toBe('/ayuda/ver-quien-me-debe');
    expect(topicHref('equipo', guides)).toBe('/ayuda');
    expect(topicHref('asistentes', guides)).toBe(ASSISTANT_PAGE_PATH);
  });

  it('next guide: preferred if written, else the next written one, else none', () => {
    const [a, b, c] = GUIDES.map(unwritten);
    const prefersC = { ...a, content: { ...CONTENT, next: c.slug } };
    expect(getNextGuide(a.slug, [prefersC, written(b), written(c)])?.slug).toBe(c.slug);
    expect(getNextGuide(a.slug, [prefersC, written(b), c])?.slug).toBe(b.slug);
    expect(getNextGuide(a.slug, [prefersC, b, c])).toBeNull();
  });
});
