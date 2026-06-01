import { resolveResourceListState } from '@/lib/resource-list-state';

describe('resolveResourceListState', () => {
  it('prioritizes loading over other states', () => {
    expect(
      resolveResourceListState({
        isLoading: true,
        loadError: 'No se pudieron cargar los clientes',
        totalCount: 0,
        visibleCount: 0,
        hasActiveFilters: false,
      }),
    ).toEqual({ kind: 'loading' });
  });

  it('returns error with the visible message after loading finishes', () => {
    expect(
      resolveResourceListState({
        isLoading: false,
        loadError: 'No se pudieron cargar los clientes',
        totalCount: 0,
        visibleCount: 0,
        hasActiveFilters: false,
      }),
    ).toEqual({
      kind: 'error',
      message: 'No se pudieron cargar los clientes',
    });
  });

  it('distinguishes a first-use empty list from filtered empty results', () => {
    expect(
      resolveResourceListState({
        isLoading: false,
        loadError: null,
        totalCount: 0,
        visibleCount: 0,
        hasActiveFilters: false,
      }),
    ).toEqual({ kind: 'empty' });

    expect(
      resolveResourceListState({
        isLoading: false,
        loadError: null,
        totalCount: 4,
        visibleCount: 0,
        hasActiveFilters: true,
      }),
    ).toEqual({ kind: 'filtered-empty' });
  });

  it('returns ready when at least one row is visible', () => {
    expect(
      resolveResourceListState({
        isLoading: false,
        loadError: null,
        totalCount: 4,
        visibleCount: 1,
        hasActiveFilters: true,
      }),
    ).toEqual({ kind: 'ready' });
  });
});
