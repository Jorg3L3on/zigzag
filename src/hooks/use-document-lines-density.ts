'use client';

import * as React from 'react';

import {
  readDocumentLinesDensity,
  subscribeDocumentLinesDensity,
  writeDocumentLinesDensity,
  type DocumentLinesDensity,
} from '@/lib/document-lines-density';

/** Detallado / Compacto for document lines, shared by every open row. */
export const useDocumentLinesDensity = () => {
  const density = React.useSyncExternalStore(
    subscribeDocumentLinesDensity,
    readDocumentLinesDensity,
    () => 'detailed' as const,
  );
  const setDensity = React.useCallback((next: DocumentLinesDensity) => {
    writeDocumentLinesDensity(next);
  }, []);
  return { density, setDensity };
};
