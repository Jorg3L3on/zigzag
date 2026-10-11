'use client';

import * as React from 'react';
import { toast } from 'sonner';

/** How long the Deshacer action stays on screen. */
export const UNDO_TOAST_DURATION_MS = 5000;

/**
 * Removing a line or material shows a toast with Deshacer instead of a confirm
 * dialog (ZIG-I13-1). The returned function applies nothing itself: the caller
 * removes the item first, then calls it with what to say and how to put it back.
 *
 * ```ts
 * const undoToast = useUndoToast();
 * undoToast(`Quitaste ${line.name}`, () => restore(line));
 * ```
 */
export const useUndoToast = () =>
  React.useCallback((label: string, onUndo: () => void): string | number => {
    return toast(label, {
      duration: UNDO_TOAST_DURATION_MS,
      action: { label: 'Deshacer', onClick: () => onUndo() },
    });
  }, []);
