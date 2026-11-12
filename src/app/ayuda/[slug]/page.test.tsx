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
    expect(generateStaticParams()).toEqual(getWrittenGuides().map(({ slug }) => ({ slug })));
    expect(generateStaticParams()).toHaveLength(GUIDES.length);
    expect(generateStaticParams()).toEqual(
      expect.arrayContaining([
        { slug: 'crear-un-ticket' },
        { slug: 'ver-quien-me-debe' },
        { slug: 'guardar-un-cliente' },
      ]),
    );
  });

  it('renders a written guide with its metadata', async () => {
    render(await AyudaGuideRoute(params('crear-un-ticket')));
    expect(screen.getByRole('heading', { level: 1, name: 'Crear un ticket' })).toBeInTheDocument();
    const metadata = await generateMetadata(params('crear-un-ticket'));
    expect(metadata.title).toBe('Crear un ticket | Ayuda ZigZag');
  });

  it('calls notFound for a slug that is not a written guide', async () => {
    await expect(AyudaGuideRoute(params('no-existe'))).rejects.toBe(notFoundError);
    // Every guide is written (ZIG-I40-3 + ZIG-I40-4): only slugs outside the list 404.
    await expect(AyudaGuideRoute(params('asistentes'))).rejects.toBe(notFoundError);
    expect(notFound).toHaveBeenCalledTimes(2);
  });
});
