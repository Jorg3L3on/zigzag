import { fireEvent, render, screen } from '@testing-library/react';

import { ListBulkBar, ListBulkBarButton } from '@/components/list-page/list-bulk-bar';
import { ListEmpty, ListError, ListNoResults } from '@/components/list-page/list-states';

describe('ListStates', () => {
  it('reports a load error as an alert with Reintentar', () => {
    const onRetry = jest.fn();
    render(<ListError onRetry={onRetry} />);
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo cargar');
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(onRetry).toHaveBeenCalled();
  });

  it('offers the page action when empty and Limpiar filtros when filtered', () => {
    const onClear = jest.fn();
    render(
      <>
        <ListEmpty title="Sin tickets" description="Aún no hay tickets." action={<button>Nuevo ticket</button>} />
        <ListNoResults onClear={onClear} />
      </>,
    );
    expect(screen.getByText('Sin tickets')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nuevo ticket' })).toBeInTheDocument();
    expect(screen.getByText('Sin resultados')).toBeInTheDocument();
    const clear = screen.getByRole('button', { name: 'Limpiar filtros' });
    expect(clear.className).not.toContain('destructive');
    fireEvent.click(clear);
    expect(onClear).toHaveBeenCalled();
  });
});

describe('ListBulkBar', () => {
  it('counts the selection, carries the actions and cancels', () => {
    const onCancel = jest.fn();
    const { rerender } = render(
      <ListBulkBar count={2} onCancel={onCancel}>
        <ListBulkBarButton>Pausar</ListBulkBarButton>
        <ListBulkBarButton destructive>Eliminar</ListBulkBarButton>
      </ListBulkBar>,
    );
    const bar = screen.getByRole('toolbar', { name: 'Acciones de la selección' });
    expect(bar).toHaveTextContent('2 seleccionados');
    expect(screen.getByRole('button', { name: 'Eliminar' }).className).toContain('text-red-300');
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onCancel).toHaveBeenCalled();
    rerender(
      <ListBulkBar count={0} onCancel={onCancel}>
        <ListBulkBarButton>Pausar</ListBulkBarButton>
      </ListBulkBar>,
    );
    expect(screen.queryByRole('toolbar')).not.toBeInTheDocument();
  });
});
