import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { PresupuestoTableItem } from '@/actions/presupuestos';
import { PresupuestoRowMenu } from '@/components/presupuestos/presupuesto-row-actions';

// userEvent flows can pass 5 s on a loaded runner (ZIG-I10 QA).
jest.setTimeout(30_000);

jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

const item = (patch: Partial<PresupuestoTableItem> = {}): PresupuestoTableItem => ({
  id: '7',
  folio: 'P-0007',
  clientName: 'Cliente',
  clientTel: '9981000002',
  ticketDate: '2026-10-10T20:21:35.000Z',
  expiresAt: null,
  total: 1000,
  status: 'abierto',
  statusLabel: 'Abierto',
  convertedToTicketId: null,
  canceledAt: null,
  servicesSummary: 'Diagnóstico técnico',
  servicesHead: ['Diagnóstico técnico'],
  servicesCount: 1,
  convertedTicketFolio: null,
  ...patch,
});

const handlers = () => ({
  onConvert: jest.fn(),
  onCancel: jest.fn(),
  onExtend: jest.fn(),
  onDuplicate: jest.fn(),
});

const menuItems = async () => {
  await userEvent.click(screen.getByRole('button', { name: 'Más acciones de P-0007' }));
  return (await screen.findAllByRole('menuitem')).map((entry) => entry.textContent);
};

describe('PresupuestoRowMenu (ZIG-I33-2)', () => {
  it('keeps only Duplicar and the PDF once canceled', async () => {
    render(
      <PresupuestoRowMenu
        item={item({ status: 'cancelado', statusLabel: 'Cancelado' })}
        canWrite
        canInvoice
        companyId={4}
        companyName="Demo"
        busy={false}
        {...handlers()}
      />,
    );

    expect(await menuItems()).toEqual(['Descargar PDF', 'Duplicar']);
  });

  it('leaves the write actions out for a read-only user', async () => {
    render(
      <PresupuestoRowMenu
        item={item()}
        canWrite={false}
        canInvoice
        companyId={4}
        companyName="Demo"
        busy={false}
        {...handlers()}
      />,
    );

    expect(await menuItems()).toEqual(['Recordar por WhatsApp', 'Descargar PDF']);
  });

  it('draws nothing when there is nothing to do', () => {
    const { container } = render(
      <PresupuestoRowMenu
        item={item({ status: 'cancelado', statusLabel: 'Cancelado' })}
        canWrite={false}
        canInvoice={false}
        companyId={4}
        companyName="Demo"
        busy={false}
        {...handlers()}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('waits while a conversion or duplicate runs', async () => {
    const actions = handlers();
    render(
      <PresupuestoRowMenu
        item={item()}
        canWrite
        canInvoice
        companyId={4}
        companyName="Demo"
        busy
        {...actions}
      />,
    );

    await menuItems();
    await userEvent.click(screen.getByRole('menuitem', { name: 'Convertir a ticket' }));
    expect(actions.onConvert).not.toHaveBeenCalled();
  });

  it('opens the conversion when idle', async () => {
    const actions = handlers();
    render(
      <PresupuestoRowMenu
        item={item()}
        canWrite
        canInvoice
        companyId={4}
        companyName="Demo"
        busy={false}
        {...actions}
      />,
    );

    await menuItems();
    await userEvent.click(screen.getByRole('menuitem', { name: 'Convertir a ticket' }));
    expect(actions.onConvert).toHaveBeenCalledWith(expect.objectContaining({ id: '7' }));
  });
});
