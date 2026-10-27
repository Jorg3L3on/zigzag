'use client';

import type { ReactNode } from 'react';
import { AlertCircle, Inbox, RotateCw, SearchX, X } from 'lucide-react';

import { TripledEmptyState, TripledListLoadingState } from '@/components/tripled';
import { Button } from '@/components/ui/button';

/*
 * The states of a desktop list (ZIG-I33 §8), so each page only passes its words.
 * A refresh never comes back here: `ListTable busy` keeps the rows, dimmed.
 */

/** First load only: the real number of columns, 8 rows. */
export const ListLoading = ({ label, columns }: { label: string; columns: number }) => (
  <TripledListLoadingState label={label} desktopColumns={columns} desktopRows={8} />
);

export const ListError = ({
  description = 'Revisa tu conexión e inténtalo de nuevo.',
  onRetry,
}: {
  description?: ReactNode;
  onRetry?: () => void;
}) => (
  <TripledEmptyState
    role="alert"
    icon={<AlertCircle className="h-4 w-4 text-destructive" aria-hidden />}
    title="No se pudo cargar"
    description={description}
    action={
      onRetry ? (
        <Button type="button" variant="outline" onClick={onRetry}>
          <RotateCw className="h-4 w-4" aria-hidden />
          Reintentar
        </Button>
      ) : undefined
    }
  />
);

/** Nothing yet: «Sin tickets» and the page action. */
export const ListEmpty = ({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
}) => (
  <TripledEmptyState
    icon={icon ?? <Inbox className="h-4 w-4 text-muted-foreground" aria-hidden />}
    title={title}
    description={description}
    action={action}
  />
);

/** Filters left nothing: «Sin resultados» and Limpiar filtros (neutral, never red). */
export const ListNoResults = ({
  description = 'Ningún elemento coincide con la búsqueda o los filtros.',
  onClear,
}: {
  description?: ReactNode;
  onClear?: () => void;
}) => (
  <TripledEmptyState
    icon={<SearchX className="h-4 w-4 text-muted-foreground" aria-hidden />}
    title="Sin resultados"
    description={description}
    action={
      onClear ? (
        <Button type="button" variant="outline" onClick={onClear}>
          <X className="h-4 w-4" aria-hidden />
          Limpiar filtros
        </Button>
      ) : undefined
    }
  />
);
