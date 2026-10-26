import * as React from 'react';

export const UNSAVED_CHANGES_MESSAGE = 'Tienes cambios sin guardar. ¿Salir sin guardar?';

/** True for a plain left click on a same-origin link to another page (hash-only jumps excluded). */
const leavesPage = (event: MouseEvent, anchor: HTMLAnchorElement): boolean => {
  if (event.defaultPrevented || event.button !== 0) return false;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
  if (anchor.target && anchor.target !== '_self') return false;
  if (anchor.hasAttribute('download')) return false;
  const href = anchor.getAttribute('href');
  if (!href || href.startsWith('#')) return false;
  const next = new URL(anchor.href, window.location.href);
  if (next.origin !== window.location.origin) return false;
  return next.pathname !== window.location.pathname || next.search !== window.location.search;
};

/**
 * While `dirty`, asks before leaving: the browser prompt on reload or close,
 * and a confirm on in-app links (side nav, sidebar, breadcrumbs). The click is
 * caught on `document` in the capture phase, before Next's Link handles it.
 */
export const useUnsavedChangesGuard = (dirty: boolean) => {
  React.useEffect(() => {
    if (!dirty) {
      return;
    }
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    const onClick = (event: MouseEvent) => {
      const anchor = (event.target as Element | null)?.closest?.('a[href]');
      if (!(anchor instanceof HTMLAnchorElement) || !leavesPage(event, anchor)) {
        return;
      }
      if (!window.confirm(UNSAVED_CHANGES_MESSAGE)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('click', onClick, true);
    };
  }, [dirty]);
};
