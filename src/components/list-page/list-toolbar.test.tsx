import { fireEvent, render, screen } from '@testing-library/react';

import { ListToolbar } from '@/components/list-page/list-toolbar';

describe('ListToolbar', () => {
  const search = { value: '', onChange: jest.fn(), placeholder: 'Buscar', ariaLabel: 'Buscar tickets' };

  it('puts the filters, Limpiar filtros and the trailing control on the search row', () => {
    const onClear = jest.fn();
    render(
      <ListToolbar
        search={search}
        filters={<button type="button">Estado</button>}
        hasActiveFilters
        onClear={onClear}
        trailing={<button type="button">Columnas</button>}
      />,
    );
    expect(screen.getByRole('textbox', { name: 'Buscar tickets' })).toBeInTheDocument();
    const columnas = screen.getByRole('button', { name: 'Columnas' });
    expect(columnas.parentElement?.className).toContain('ml-auto');
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
    expect(onClear).toHaveBeenCalled();
  });

  it('hides Limpiar filtros while nothing is filtered', () => {
    render(
      <ListToolbar
        search={search}
        filters={<button type="button">Estado</button>}
        hasActiveFilters={false}
        onClear={jest.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Limpiar filtros' })).not.toBeInTheDocument();
  });
});
