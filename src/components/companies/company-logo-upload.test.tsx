import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CompanyLogoUpload } from '@/components/companies/company-logo-upload';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: jest.fn() }),
}));

jest.mock('@/actions/companies', () => ({
  uploadCompanyLogo: jest.fn(),
  removeCompanyLogo: jest.fn(),
}));

jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

describe('CompanyLogoUpload', () => {
  it('keeps the file input out of layout so /company does not overflow at 375px', () => {
    render(<CompanyLogoUpload companyId={4} logoUrl={null} />);

    const input = screen.getByLabelText('Seleccionar archivo de logo');
    expect(input).toHaveAttribute('type', 'file');
    // display:none — no box to stretch, and no invisible extra tab stop.
    expect(input).toHaveClass('hidden');
    // The shared <Input> styles (w-full beat sr-only) caused the 433px scrollWidth.
    expect(input).not.toHaveClass('w-full');
  });

  it('opens the file picker from the Subir logo button', () => {
    render(<CompanyLogoUpload companyId={4} logoUrl={null} />);

    const input = screen.getByLabelText('Seleccionar archivo de logo');
    const pick = jest.spyOn(input as HTMLInputElement, 'click');
    const button = screen.getByRole('button', { name: 'Subir logo' });

    expect(button).toHaveAttribute('type', 'button');
    fireEvent.click(button);
    expect(pick).toHaveBeenCalledTimes(1);
  });

  describe('logo preview', () => {
    const logoUrl =
      'https://abc.public.blob.vercel-storage.com/company-logos/4/logo.png';

    it('shows a placeholder until the logo loads', async () => {
      render(<CompanyLogoUpload companyId={4} logoUrl={logoUrl} />);

      const img = screen.getByAltText('Logo actual de la empresa');
      expect(screen.getByTestId('company-logo-skeleton')).toBeInTheDocument();
      expect(img).toHaveClass('opacity-0');

      fireEvent.load(img);

      await waitFor(() =>
        expect(screen.queryByTestId('company-logo-skeleton')).not.toBeInTheDocument(),
      );
      expect(img).toHaveClass('opacity-100');
    });

    it('swaps the placeholder for a fallback when the logo fails', async () => {
      render(<CompanyLogoUpload companyId={4} logoUrl={logoUrl} />);

      fireEvent.error(screen.getByAltText('Logo actual de la empresa'));

      expect(await screen.findByText('Logo no disponible')).toBeInTheDocument();
      expect(screen.queryByTestId('company-logo-skeleton')).not.toBeInTheDocument();
    });

    it('shows Sin logo without a placeholder when there is no logo', () => {
      render(<CompanyLogoUpload companyId={4} logoUrl={null} />);

      expect(screen.getByText('Sin logo')).toBeInTheDocument();
      expect(screen.queryByTestId('company-logo-skeleton')).not.toBeInTheDocument();
    });
  });
});
