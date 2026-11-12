import { render, screen } from '@testing-library/react';
import AyudaGuideRoute, {
  dynamicParams,
  generateMetadata,
  generateStaticParams,
} from '@/app/ayuda/[slug]/page';
import { getWrittenGuides, GUIDES } from '@/components/ayuda/guide-registry';

const notFoundError = new Error('NEXT_NOT_FOUND');

jest.mock('next/navigation', () => ({
  notFound: jest.fn(() => {
    throw notFoundError;
  }),
}));

const { notFound } = jest.requireMock('next/navigation') as { notFound: jest.Mock };

const params = (slug: string) => ({ params: Promise.resolve({ slug }) });

describe('/ayuda/[slug] (ZIG-I40-2)', () => {
  it('is statically generated for written guides only', () => {
    expect(dynamicParams).toBe(false);
    expect(generateStaticParams()).toEqual(getWrittenGuides().map((guide) => ({ slug: guide.slug })));
    expect(generateStaticParams()).toContainEqual({ slug: 'crear-un-ticket' });
    expect(generateStaticParams()).toContainEqual({ slug: 'guardar-un-cliente' });
  });

  it('renders a written guide with its metadata', async () => {
    render(await AyudaGuideRoute(params('crear-un-ticket')));
    expect(screen.getByRole('heading', { level: 1, name: 'Crear un ticket' })).toBeInTheDocument();
    const metadata = await generateMetadata(params('crear-un-ticket'));
    expect(metadata.title).toBe('Crear un ticket | Ayuda ZigZag');
  });

  it('calls notFound for an unknown slug and for a guide that is not written yet', async () => {
    await expect(AyudaGuideRoute(params('no-existe'))).rejects.toBe(notFoundError);
    // Once every guide is written there is no unwritten slug left to try.
    const unwritten = GUIDES.find((guide) => !guide.content);
    if (unwritten) {
      await expect(AyudaGuideRoute(params(unwritten.slug))).rejects.toBe(notFoundError);
    }
    expect(notFound).toHaveBeenCalledTimes(unwritten ? 2 : 1);
  });
});
