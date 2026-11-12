import { render } from '@testing-library/react';
import { useUnsavedChangesGuard } from '@/hooks/use-unsaved-changes-guard';

const Guarded = ({ dirty }: { dirty: boolean }) => {
  useUnsavedChangesGuard(dirty);
  return (
    <div>
      <a href="/company/equipo">Equipo</a>
      <a href="#direccion">Dirección</a>
    </div>
  );
};

const click = (element: Element) => {
  const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
  element.dispatchEvent(event);
  return event;
};

describe('useUnsavedChangesGuard (ZIG-I32)', () => {
  const confirm = jest.spyOn(window, 'confirm');

  beforeEach(() => {
    confirm.mockReset();
    window.history.replaceState(null, '', '/company');
  });

  it('asks before following a link to another page and stays when cancelled', () => {
    confirm.mockReturnValue(false);
    const { getByText } = render(<Guarded dirty />);

    const event = click(getByText('Equipo'));

    expect(confirm).toHaveBeenCalledWith('Tienes cambios sin guardar. ¿Salir sin guardar?');
    expect(event.defaultPrevented).toBe(true);
  });

  it('lets the link through when confirmed, and never asks for in-page anchors', () => {
    confirm.mockReturnValue(true);
    const { getByText } = render(<Guarded dirty />);

    expect(click(getByText('Equipo')).defaultPrevented).toBe(false);
    confirm.mockClear();
    click(getByText('Dirección'));
    expect(confirm).not.toHaveBeenCalled();
  });

  it('does nothing without changes and asks on reload while dirty', () => {
    const { getByText, rerender } = render(<Guarded dirty={false} />);
    click(getByText('Equipo'));
    expect(confirm).not.toHaveBeenCalled();

    rerender(<Guarded dirty />);
    const unload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);
  });
});
