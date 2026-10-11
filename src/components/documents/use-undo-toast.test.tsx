/**
 * @jest-environment jsdom
 */
import { renderHook } from '@testing-library/react';
import { toast } from 'sonner';

import { UNDO_TOAST_DURATION_MS, useUndoToast } from '@/components/documents/use-undo-toast';

jest.mock('sonner', () => ({ toast: jest.fn(() => 'toast-1') }));

describe('useUndoToast (ZIG-I13-1)', () => {
  it('shows a 5 s toast whose Deshacer action runs the undo', () => {
    const { result } = renderHook(() => useUndoToast());
    const onUndo = jest.fn();
    expect(result.current('Quitaste Carga de gas', onUndo)).toBe('toast-1');

    expect(toast).toHaveBeenCalledWith(
      'Quitaste Carga de gas',
      expect.objectContaining({ duration: UNDO_TOAST_DURATION_MS }),
    );
    expect(UNDO_TOAST_DURATION_MS).toBe(5000);
    const { action } = (toast as unknown as jest.Mock).mock.calls[0][1];
    expect(action.label).toBe('Deshacer');
    action.onClick();
    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it('keeps the same function between renders', () => {
    const { result, rerender } = renderHook(() => useUndoToast());
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });
});
