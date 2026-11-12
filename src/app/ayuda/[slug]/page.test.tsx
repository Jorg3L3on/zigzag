import { render, screen } from '@testing-library/react';
import AyudaGuideRoute, {
  dynamicParams,
  generateMetadata,
  generateStaticParams,
} from '@/app/ayuda/[slug]/page';

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
    expect(generateStaticParams()).toEqual([{ slug: 'crear-un-ticket' }]);
  });

  it('renders a written guide with its metadata', async () => {
    render(await AyudaGuideRoute(params('crear-un-ticket')));
    expect(screen.getByRole('heading', { level: 1, name: 'Crear un ticket' })).toBeInTheDocument();
    const metadata = await generateMetadata(params('crear-un-ticket'));
    expect(metadata.title).toBe('Crear un ticket | Ayuda ZigZag');
  });

  it('calls notFound for an unknown slug and for a guide that is not written yet', async () => {
    await expect(AyudaGuideRoute(params('no-existe'))).rejects.toBe(notFoundError);
    await expect(AyudaGuideRoute(params('ver-quien-me-debe'))).rejects.toBe(notFoundError);
    expect(notFound).toHaveBeenCalledTimes(2);
  });
});
