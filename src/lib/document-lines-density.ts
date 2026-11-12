export const DOCUMENT_LINES_DENSITY_KEY = 'zigzag:document-lines-density:v1';

/** Compacto (the default) folds each line behind a chip. Detallado shows every
 * material block. */
export type DocumentLinesDensity = 'detailed' | 'compact';

const listeners = new Set<() => void>();

const emit = () => {
  for (const listener of listeners) listener();
};

export const subscribeDocumentLinesDensity = (listener: () => void) => {
  listeners.add(listener);
  if (typeof window === 'undefined') return () => listeners.delete(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === DOCUMENT_LINES_DENSITY_KEY) listener();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
};

/** Missing or unreadable storage is Compacto, the default (Jorge, 2026-11-11). */
export const readDocumentLinesDensity = (): DocumentLinesDensity => {
  try {
    return window.localStorage.getItem(DOCUMENT_LINES_DENSITY_KEY) === 'detailed'
      ? 'detailed'
      : 'compact';
  } catch {
    return 'compact';
  }
};

export const writeDocumentLinesDensity = (density: DocumentLinesDensity) => {
  try {
    if (density === 'detailed') {
      window.localStorage.setItem(DOCUMENT_LINES_DENSITY_KEY, 'detailed');
    } else {
      window.localStorage.removeItem(DOCUMENT_LINES_DENSITY_KEY);
    }
  } catch {
    // Private mode: the choice still updates this tab until reload.
  }
  emit();
};
