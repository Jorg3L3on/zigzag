/**
 * @jest-environment node
 */
import nextConfig from '../next.config';

// The plugins wrap the config object and keep redirects(); they ship ESM only,
// so jest gets identity stand-ins.
jest.mock('@serwist/turbopack', () => ({ withSerwist: (config: unknown) => config }));
jest.mock('next-intl/plugin', () => () => (config: unknown) => config);

describe('next.config redirects (ZIG-I40-6)', () => {
  it('sends the retired /guides pages to /ayuda and the old connector guide to /ayuda/asistentes', async () => {
    expect(nextConfig.redirects).toBeInstanceOf(Function);
    const redirects = await nextConfig.redirects!();

    expect(redirects).toEqual([
      { source: '/guides', destination: '/ayuda', permanent: true },
      { source: '/guides/', destination: '/ayuda', permanent: true },
      { source: '/guides/index.html', destination: '/ayuda', permanent: true },
      { source: '/guides/guia-empresa.html', destination: '/ayuda', permanent: true },
      { source: '/guides/resumen-ejecutivo.html', destination: '/ayuda', permanent: true },
      { source: '/guides/:path*', destination: '/ayuda', permanent: true },
      { source: '/docs/mcp-connector', destination: '/ayuda/asistentes', permanent: true },
    ]);
  });
});
