/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { ServiceForm } from '@/components/services/service-form';

const mockCreateService = jest.fn();

jest.mock('@/actions/services', () => ({
  createService: (...args: unknown[]) => mockCreateService(...args),
  updateService: jest.fn(),
}));

jest.mock('@/contexts/company-context', () => ({
  useCompany: () => ({ selectedCompany: { id: 1, name: 'Demo Co' } }),
}));

jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

const fillAndSubmit = (description: string) => {
  fireEvent.change(screen.getByPlaceholderText('Describe el servicio...'), {
    target: { value: description },
  });
  fireEvent.change(screen.getByPlaceholderText('Ej: Limpieza de oficinas'), {
    target: { value: 'Mantenimiento' },
  });
  fireEvent.change(screen.getByPlaceholderText('0.00'), {
    target: { value: '4200' },
  });
  fireEvent.submit(
    screen.getByPlaceholderText('Describe el servicio...').closest('form')!,
  );
};

describe('ServiceForm description limit', () => {
  beforeEach(() => {
    mockCreateService.mockReset();
    mockCreateService.mockResolvedValue({
      success: true,
      data: { id: 1, name: 'Mantenimiento', description: 'x', price: '4200' },
    });
  });

  it('shows the 240 counter and accepts exactly 240 characters', async () => {
    render(<ServiceForm />);
    expect(screen.getByText('0/240')).toBeTruthy();

    fillAndSubmit('a'.repeat(240));

    expect(screen.getByText('240/240')).toBeTruthy();
    await waitFor(() => expect(mockCreateService).toHaveBeenCalledTimes(1));
    expect(mockCreateService.mock.calls[0][0].description).toHaveLength(240);
  });

  it('rejects 241 characters without calling the action', async () => {
    render(<ServiceForm />);

    fillAndSubmit('a'.repeat(241));

    expect(
      await screen.findByText(/La descripción no puede exceder 240 caracteres/),
    ).toBeTruthy();
    expect(screen.getByText('241/240')).toBeTruthy();
    expect(mockCreateService).not.toHaveBeenCalled();
  });
});
