import { redirectPresupuestoToOwnPage } from '@/lib/presupuesto-route-guard';

const mockGetPresupuestoById = jest.fn();
const mockRedirect = jest.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`);
});

jest.mock('@/actions/presupuestos', () => ({
  getPresupuestoById: (...args: unknown[]) => mockGetPresupuestoById(...args),
}));

jest.mock('next/navigation', () => ({
  redirect: (url: string) => mockRedirect(url),
}));

describe('redirectPresupuestoToOwnPage (ZIG-I5-4)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('sends a presupuesto to /presupuestos/[id]', async () => {
    mockGetPresupuestoById.mockResolvedValue({ success: true, data: { id: 1055n } });
    await expect(redirectPresupuestoToOwnPage('1055')).rejects.toThrow(
      'REDIRECT:/presupuestos/1055',
    );
  });

  it('leaves work tickets alone', async () => {
    mockGetPresupuestoById.mockResolvedValue({ success: false, errorCode: 'TC008' });
    await expect(redirectPresupuestoToOwnPage('1053')).resolves.toBeUndefined();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it('ignores ids that are not positive integers', async () => {
    await expect(redirectPresupuestoToOwnPage('abc')).resolves.toBeUndefined();
    expect(mockGetPresupuestoById).not.toHaveBeenCalled();
  });
});
