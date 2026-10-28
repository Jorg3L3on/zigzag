import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ListCardMenu } from '@/components/list-page/list-card-menu';

describe('ListCardMenu', () => {
  it('opens the phone ⋮ without reaching the card, with links, labels and disabled items', async () => {
    const user = userEvent.setup();
    const onCard = jest.fn();
    const onDelete = jest.fn();
    const onBlocked = jest.fn();
    render(
      <div onClick={onCard}>
        <ListCardMenu
          label="Más acciones de R-0060"
          triggerClassName="size-11"
          itemClassName="min-h-11"
          items={[
            { label: 'Ver detalles', icon: null, href: '/tickets/7', onSelect: jest.fn() },
            { label: 'Cobrar', icon: null, onSelect: onBlocked, disabled: true, hint: 'sin saldo' },
            {
              label: 'Eliminar',
              ariaLabel: 'Eliminar R-0060',
              icon: null,
              onSelect: onDelete,
              destructive: true,
            },
          ]}
        />
      </div>,
    );

    const trigger = screen.getByRole('button', { name: 'Más acciones de R-0060' });
    expect(trigger).toHaveClass('size-11');
    await user.click(trigger);
    expect(onCard).not.toHaveBeenCalled();

    const detail = await screen.findByRole('menuitem', { name: 'Ver detalles' });
    expect(detail.closest('a')).toHaveAttribute('href', '/tickets/7');
    expect(detail).toHaveClass('min-h-11');
    expect(screen.getByRole('menuitem', { name: 'Cobrar (sin saldo)' })).toHaveAttribute('data-disabled');

    const remove = screen.getByRole('menuitem', { name: 'Eliminar R-0060' });
    expect(remove).toHaveClass('text-destructive');
    await user.click(remove);
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onBlocked).not.toHaveBeenCalled();
    expect(onCard).not.toHaveBeenCalled();
  });
});
