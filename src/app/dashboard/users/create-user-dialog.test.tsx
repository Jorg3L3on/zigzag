import { render, screen, waitFor } from '@testing-library/react';
import { CreateUserDialog } from '@/app/dashboard/users/create-user-dialog';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: jest.fn() }),
}));

jest.mock('@/actions/companies', () => ({
  getCompanies: jest.fn(async () => ({ success: true, data: [] })),
}));

jest.mock('@/actions/roles', () => ({
  getRoles: jest.fn(async () => ({ success: true, data: [] })),
}));

jest.mock('@/actions/users', () => ({
  createUser: jest.fn(),
}));

jest.mock('@/components/companies/company-entitlement-notice', () => ({
  CompanyEntitlementNotice: () => null,
}));

describe('CreateUserDialog', () => {
  it('locks company field when defaultCompanyId is provided', async () => {
    render(
      <CreateUserDialog
        defaultCompanyId={42}
        defaultCompanyName="Acme"
        lockCompany
      />,
    );

    const trigger = screen.getByRole('button', { name: /crear usuario/i });
    trigger.click();

    await waitFor(() => {
      expect(screen.getByDisplayValue('Acme')).toBeInTheDocument();
    });
  });
});
