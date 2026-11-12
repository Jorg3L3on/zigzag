import { fireEvent, render, screen, within } from '@testing-library/react';
import { GuidePage } from '@/components/ayuda/guide-page';
import { getWrittenGuide } from '@/components/ayuda/guide-registry';

const renderGuide = (slug: string) =>
  render(<GuidePage guide={getWrittenGuide(slug)!} whatsappHref={null} />);

describe('guide videos (ZIG-40)', () => {
  it.each([
    ['crear-un-ticket', ['KFcDHh97038', 'N5vZ_BiCITw']],
    ['hacer-un-presupuesto', ['eR3oeWtnx6A', 'zZefkCT0Yj4']],
  ])('%s shows the computer and phone videos, no player until tapped', (slug, ids) => {
    renderGuide(slug);
    const section = screen.getByTestId('ayuda-videos');
    expect(within(section).getByRole('heading', { name: 'Míralo en video' })).toBeInTheDocument();
    expect(within(section).getByText('En la computadora')).toBeInTheDocument();
    expect(within(section).getByText('En el celular')).toBeInTheDocument();
    expect(section.querySelector('iframe')).toBeNull();
    const links = within(section).getAllByRole('link', { name: 'Abrir en YouTube' });
    expect(links.map((link) => link.getAttribute('href'))).toEqual(ids.map((id) => `https://youtu.be/${id}`));
  });

  it('tapping a video swaps the thumbnail for the youtube-nocookie player', () => {
    renderGuide('crear-un-ticket');
    fireEvent.click(
      screen.getByRole('button', { name: 'Ver video: Cómo crear un ticket en ZigZag desde tu celular' }),
    );
    const frame = screen.getByTitle('Cómo crear un ticket en ZigZag desde tu celular');
    expect(frame.tagName).toBe('IFRAME');
    expect(frame).toHaveAttribute(
      'src',
      'https://www.youtube-nocookie.com/embed/N5vZ_BiCITw?autoplay=1&rel=0&playsinline=1',
    );
    expect(screen.getAllByRole('button', { name: /^Ver video:/ })).toHaveLength(1);
  });

  it('a guide without videos has no video block', () => {
    renderGuide('ver-quien-me-debe');
    expect(screen.queryByTestId('ayuda-videos')).toBeNull();
  });
});
