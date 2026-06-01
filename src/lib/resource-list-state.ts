export type ResourceListState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'empty' }
  | { kind: 'filtered-empty' }
  | { kind: 'ready' };

type ResolveResourceListStateInput = {
  isLoading: boolean;
  loadError?: string | null;
  totalCount: number;
  visibleCount: number;
  hasActiveFilters: boolean;
};

export const resolveResourceListState = ({
  isLoading,
  loadError,
  totalCount,
  visibleCount,
  hasActiveFilters,
}: ResolveResourceListStateInput): ResourceListState => {
  if (isLoading) {
    return { kind: 'loading' };
  }

  if (loadError) {
    return { kind: 'error', message: loadError };
  }

  if (visibleCount > 0) {
    return { kind: 'ready' };
  }

  if (totalCount > 0 || hasActiveFilters) {
    return { kind: 'filtered-empty' };
  }

  return { kind: 'empty' };
};
