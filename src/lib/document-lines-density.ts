export const DOCUMENT_LINES_DENSITY_KEY = 'zigzag:document-lines-density:v1';

/** Detallado shows every material block. Compacto folds each line behind a chip. */
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

/** Missing or unreadable storage is Detallado. */
export const readDocumentLinesDensity = (): DocumentLinesDensity => {
  try {
    return window.localStorage.getItem(DOCUMENT_LINES_DENSITY_KEY) === 'compact'
      ? 'compact'
      : 'detailed';
  } catch {
    return 'detailed';
  }
};

export const writeDocumentLinesDensity = (density: DocumentLinesDensity) => {
  try {
    if (density === 'compact') {
      window.localStorage.setItem(DOCUMENT_LINES_DENSITY_KEY, 'compact');
    } else {
      window.localStorage.removeItem(DOCUMENT_LINES_DENSITY_KEY);
    }
  } catch {
    // Private mode: the choice still updates this tab until reload.
  }
  emit();
};
