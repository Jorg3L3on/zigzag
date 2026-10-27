import { fireEvent, render, screen } from '@testing-library/react';

import { ListClickableRow } from '@/components/list-page/list-clickable-row';

const push = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

const renderRow = (props: React.ComponentProps<typeof ListClickableRow>) =>
  render(
    <table>
      <tbody>
        <ListClickableRow data-testid="row" {...props}>
          <td>R-0001</td>
          <td>
            <input type="checkbox" aria-label="Seleccionar" />
            <button type="button">Cobrar</button>
          </td>
        </ListClickableRow>
      </tbody>
    </table>,
  );

describe('ListClickableRow', () => {
  beforeEach(() => push.mockClear());

  it('pushes its href on click, Enter and Space', () => {
    renderRow({ href: '/tickets/1' });
    const row = screen.getByTestId('row');
    fireEvent.click(screen.getByText('R-0001'));
    fireEvent.keyDown(row, { key: 'Enter' });
    fireEvent.keyDown(row, { key: ' ' });
    expect(push).toHaveBeenCalledTimes(3);
    expect(push).toHaveBeenCalledWith('/tickets/1');
  });

  it('ignores clicks and keys on the controls inside it', () => {
    const onOpen = jest.fn();
    renderRow({ onOpen });
    fireEvent.click(screen.getByRole('button', { name: 'Cobrar' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Seleccionar' }));
    fireEvent.keyDown(screen.getByRole('button', { name: 'Cobrar' }), { key: 'Enter' });
    fireEvent.keyDown(screen.getByTestId('row'), { key: 'a' });
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('marks the open row selected and is not focusable without an action', () => {
    const { rerender } = renderRow({ onOpen: jest.fn(), selected: true });
    expect(screen.getByTestId('row')).toHaveAttribute('data-state', 'selected');
    rerender(
      <table>
        <tbody>
          <ListClickableRow data-testid="row">
            <td>R-0001</td>
          </ListClickableRow>
        </tbody>
      </table>,
    );
    expect(screen.getByTestId('row')).not.toHaveAttribute('tabindex');
    expect(screen.getByTestId('row')).not.toHaveAttribute('data-state');
  });
});
