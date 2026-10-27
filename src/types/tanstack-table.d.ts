import '@tanstack/react-table';

declare module '@tanstack/react-table' {
  interface ColumnMeta<TData extends unknown, TValue> {
    /**
     * Classes for the column's header and cells, e.g. `hidden xl:table-cell` to drop a
     * column on small desktop windows so Total and ⋮ fit (ZIG-I27-2).
     */
    className?: string;
    /** Numbers (Total, Saldo…): right-aligned tabular figures in the th and the td (ZIG-I33). */
    align?: 'right';
  }
}
