import { fireEvent, render, screen } from '@testing-library/react';

import { ListFooter, pagerPages } from '@/components/list-page/list-footer';

const pagination = (pageIndex: number, pageCount: number, onPageChange = jest.fn()) => ({
  pageIndex,
  pageSize: 25,
  pageCount,
  onPageChange,
});

describe('ListFooter', () => {
  it('reads «1–25 de N tickets» and shows the pager with more than one page', () => {
    const onPageChange = jest.fn();
    render(<ListFooter total={60} noun="tickets" pagination={pagination(0, 3, onPageChange)} />);
    expect(screen.getByText('1–25 de 60 tickets')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Paginación' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Página 1' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Página anterior' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Página 3' }));
    expect(onPageChange).toHaveBeenCalledWith(2);
    fireEvent.click(screen.getByRole('button', { name: 'Página siguiente' }));
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it('ends the last page at the total', () => {
    render(<ListFooter total={60} noun="tickets" pagination={pagination(2, 3)} />);
    expect(screen.getByText('51–60 de 60 tickets')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Página siguiente' })).toBeDisabled();
  });

  it('has no pager on a single page, only the count with its noun', () => {
    render(<ListFooter total={6} noun="presupuestos" pagination={pagination(0, 1)} />);
    expect(screen.getByText('6 de 6 presupuestos')).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('counts the shown rows without pagination and carries an extra line', () => {
    render(<ListFooter total={12} shown={8} noun="personas" extra={<span>· suman $1,200</span>} />);
    expect(screen.getByText('8 de 12 personas')).toBeInTheDocument();
    expect(screen.getByText('· suman $1,200')).toBeInTheDocument();
  });

  it('shows «Por página» only for server pagination', () => {
    const { rerender } = render(
      <ListFooter total={60} noun="tickets" pagination={pagination(0, 3)} />,
    );
    expect(screen.queryByText('Por página')).not.toBeInTheDocument();
    rerender(
      <ListFooter
        total={60}
        noun="tickets"
        pagination={{ ...pagination(0, 3), onPageSizeChange: jest.fn() }}
      />,
    );
    expect(screen.getByText('Por página')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Filas por página' })).toBeInTheDocument();
  });

  it('loads more for cursor lists', () => {
    const onLoadMore = jest.fn();
    const { rerender } = render(
      <ListFooter total={40} noun="eventos" label="40 eventos cargados" loadMore={{ onLoadMore, hasMore: true }} />,
    );
    expect(screen.getByText('40 eventos cargados')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cargar más' }));
    expect(onLoadMore).toHaveBeenCalled();
    rerender(
      <ListFooter total={40} noun="eventos" label="40 eventos cargados" loadMore={{ onLoadMore, hasMore: false }} />,
    );
    expect(screen.queryByRole('button', { name: 'Cargar más' })).not.toBeInTheDocument();
  });

  it('numbers pages with gaps', () => {
    expect(pagerPages(1, 3)).toEqual([1, 2, 3]);
    expect(pagerPages(5, 12)).toEqual([1, 'gap', 4, 5, 6, 'gap', 12]);
  });
});
