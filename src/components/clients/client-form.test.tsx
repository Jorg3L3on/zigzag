/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ClientForm } from '@/components/clients/client-form';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
}));
jest.mock('@/contexts/company-context', () => ({
  useCompany: () => ({ selectedCompany: { id: 10, name: 'Demo' } }),
}));
jest.mock('@/actions/clients', () => ({
  createClient: jest.fn(),
  updateClient: jest.fn(),
}));
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

describe('ClientForm limits (ZIG-I12)', () => {
  it('counts the name from 80 characters and stops at 100', async () => {
    const user = userEvent.setup();
    render(<ClientForm />);
    const name = screen.getByPlaceholderText('Nombre del cliente');

    await user.type(name, 'a'.repeat(79));
    expect(screen.queryByTestId('char-counter')).toBeNull();
    await user.type(name, 'a');
    expect(screen.getByTestId('char-counter')).toHaveTextContent('80/100');

    await user.type(name, 'b'.repeat(40));
    expect(name).toHaveValue('a'.repeat(80) + 'b'.repeat(20));
    expect(screen.getByTestId('char-counter')).toHaveTextContent('100/100');
  });

  it('says what the phone field kept when it drops +, spaces and an extension label', async () => {
    const user = userEvent.setup();
    render(<ClientForm />);
    const phone = screen.getByPlaceholderText('Teléfono del cliente');

    await user.click(phone);
    await user.paste('+52 (998) 100-0000 ext. 12345');

    expect(phone).toHaveValue('52998100000012345');
    expect(screen.getByRole('status')).toHaveTextContent(
      'Guardamos solo dígitos: 52998100000012345',
    );
  });

  it('shows no note while the phone is already plain digits', async () => {
    const user = userEvent.setup();
    render(<ClientForm />);

    await user.type(screen.getByPlaceholderText('Teléfono del cliente'), '9981000000');

    expect(screen.queryByRole('status')).toBeNull();
  });

  it('caps the phone at 20 digits and says so', async () => {
    const user = userEvent.setup();
    render(<ClientForm />);
    const phone = screen.getByPlaceholderText('Teléfono del cliente');

    await user.click(phone);
    await user.paste('1'.repeat(25));

    expect(phone).toHaveValue('1'.repeat(20));
    expect(screen.getByRole('status')).toHaveTextContent('Máximo 20 dígitos');
  });
});
