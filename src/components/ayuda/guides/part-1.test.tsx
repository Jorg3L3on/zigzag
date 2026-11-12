import { render, screen, within } from '@testing-library/react';
import {
  getHelpCards,
  getNextGuide,
  getWrittenGuide,
  guideHref,
} from '@/components/ayuda/guide-registry';
import { GuidePage } from '@/components/ayuda/guide-page';
import { GUIDES_PART_1_CONTENT } from '@/components/ayuda/guides/part-1';

const PART_1 = [
  'agregar-materiales-a-un-ticket',
  'terminar-un-ticket',
  'anotar-un-pago-o-un-anticipo',
  'ver-quien-me-debe',
  'mandar-el-recibo-por-whatsapp',
  'hacer-un-presupuesto',
  'convertir-un-presupuesto-a-ticket',
];

describe('help guides part 1 (ZIG-I40-3)', () => {
  it('has content for exactly the seven guides, all written in the registry', () => {
    expect(Object.keys(GUIDES_PART_1_CONTENT).sort()).toEqual([...PART_1].sort());
    for (const slug of PART_1) expect(getWrittenGuide(slug)).not.toBeNull();
  });

  it.each(PART_1)('%s: 3 to 6 steps, each with a piece, and a written next guide', (slug) => {
    const { content } = getWrittenGuide(slug)!;
    expect(content.steps.length).toBeGreaterThanOrEqual(3);
    expect(content.steps.length).toBeLessThanOrEqual(6);
    for (const step of content.steps) expect(step.piece.kind).toBeTruthy();
    expect(content.next).toBeDefined();
    expect(getWrittenGuide(content.next!)).not.toBeNull();
    expect(getNextGuide(slug)?.slug).toBe(content.next);
  });

  it('every guide has a card on /ayuda', () => {
    const hrefs = getHelpCards().map((card) => card.href);
    for (const slug of PART_1) expect(hrefs).toContain(guideHref(slug));
  });

  it.each(PART_1)('%s renders numbered steps and links its next guide', (slug) => {
    const guide = getWrittenGuide(slug)!;
    const { unmount } = render(<GuidePage guide={guide} whatsappHref={null} />);
    const steps = screen.getAllByTestId('ayuda-step');
    expect(steps).toHaveLength(guide.content.steps.length);
    steps.forEach((step, index) =>
      expect(within(step).getByRole('heading', { level: 2 })).toHaveTextContent(
        `Paso ${index + 1}: ${guide.content.steps[index].title}`,
      ),
    );
    const next = getWrittenGuide(guide.content.next!)!;
    expect(screen.getByRole('link', { name: `Sigue: ${next.title}` })).toHaveAttribute(
      'href',
      guideHref(next.slug),
    );
    unmount();
  });

  it('the receipt guide says the recibo is not a CFDI and the message is the app text', () => {
    render(<GuidePage guide={getWrittenGuide('mandar-el-recibo-por-whatsapp')!} whatsappHref={null} />);
    expect(screen.getByText(/No es un CFDI/)).toBeInTheDocument();
    expect(
      screen.getByText(/Te compartimos el recibo del ticket T-0142 a nombre de Sra\. Lupita/),
    ).toBeInTheDocument();
  });
});
