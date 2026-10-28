# Listas en escritorio (ZIG-I33)

Copia corta del estándar. La fuente completa es el doc «Estándar de listas en escritorio» de la iniciativa ZIG-I33 en Plania; si este archivo y el doc difieren, manda el doc.

Aplica a toda página de lista con tabla desde **1024 px** (`lg`): Tickets, Presupuestos, Cobranza, Clientes, Servicios, Recordatorios, Equipo, Roles, Usuarios, Permisos, Empresas, Auditoría y la Consola operadora. El teléfono (< 1024 px) no cambia.

## Reglas en una lista

1. **Marco**: `DesktopSwitch` elige un solo árbol; `TripledResourceCard desktop="page"` disuelve la tarjeta. Título `ListDesktopTitle` «Tickets · N» (N = total sin filtrar) con **una** descripción y las acciones a la derecha. Un solo botón azul sólido por página; el resto `outline`.
2. **Barra** (`ListToolbar`, una fila): búsqueda (300 ms, fuera de la URL) · filtros como `ListFilterSelect` (píldora, tinte al elegir) · «Limpiar filtros» solo con filtros activos (nunca rojo) · `ListColumnsMenu` a la derecha si hay ≥ 6 columnas. Sin chips ni select de orden en escritorio. `ListViewTabs` encima, solo si la lista tiene estados.
3. **Orden**: solo por clic en el encabezado (`ListSortableHeader`); `aria-sort` va en el `th` (lo pone `ListTable`). En servidor si la lista pagina en servidor (`manualSorting`), si no `getSortedRowModel`.
4. **Tabla**: `ListTable` dentro de `ListTableCard`. Encabezado fijo `top-16` sobre `bg-list-head` (opaco en los dos temas), filas `h-14`, `px-3` (`dense` → `px-1.5`). Numéricos con `meta: { align: 'right' }`. La fila abre el elemento con clic, Enter o Espacio.
5. **Acciones**: `ListRowMenu` ⋯ siempre visible, más a lo sumo un botón visible (`outline sm h-8`) donde la página existe para esa acción (Cobrar, Restaurar, Seleccionar). **Nada aparece al pasar el cursor.**
6. **Estados y fechas**: `ListStatusPill` (emerald / amber / red / slate / blue / violet) para estados; `ui/badge` solo para etiquetas. `ListShortDate` («8 oct», año solo si no es el actual, calendario de la empresa) en toda columna de fecha; `FormattedDate` solo donde importa la hora.
7. **Pie**: `ListFooter` dentro de la tarjeta: «1–25 de N tickets» y el paginador solo con más de una página; «Por página» 10/25/50 con paginación en servidor. 25 por página en todas. Auditoría y Actividad: «Cargar más».
8. **Estados**: `ListLoading` en la primera carga; al refrescar, `ListTable busy` (la tabla se queda atenuada, sin esqueleto). `ListError` (alerta + Reintentar), `ListEmpty` («Sin X» + la acción), `ListNoResults` («Sin resultados» + Limpiar filtros), `SystemCompanyContextEmptyState` sin empresa. Cada ruta con `loading.tsx` (`ResourceRouteLoading`).

## Mapa de piezas (`src/components/list-page/`)

| Pieza | Para qué |
|---|---|
| `ListDesktopTitle` | h1 con « · N», descripción y acciones (solo desde lg). |
| `ListToolbar` | Búsqueda + filtros + Limpiar + `trailing`; debajo de lg monta la hoja de teléfono de siempre (`sheetContent`, `filterChips`, `mobileSort`). |
| `ListFilterSelect` | Filtro píldora con tinte cuando no es «todos». |
| `ListViewTabs` | Pestañas de vista con conteos (nunca montos). |
| `ListColumnsMenu` + `useListHiddenColumns` | «Columnas», recordadas en el navegador. |
| `ListTable` | La tabla: receta `LIST_TABLE_CLASS` (en `ui/table.tsx`), encabezado fijo, `aria-sort`, filas con teclado, `busy`, `dense`. |
| `ListTableCard` | La tarjeta con slot `footer`. |
| `ListSortableHeader` | Encabezado ordenable (11 px mayúsculas, flecha `size-3`). |
| `ListClickableRow` | Fila con `tabIndex`, Enter / Espacio, `href` u `onOpen`; ignora clics en controles. `ListTable` la usa por defecto; `renderRow` para filas a medida. |
| `ListRowMenu` | El ⋯ de cada fila; destructivas al final; `disabled` + `hint` para una acción bloqueada («Desactivar (eres tú)»). |
| `ListCardMenu` | El ⋮ de las tarjetas de teléfono (Clientes, Cobranza), con enlaces; solo para el árbol de teléfono. |
| `ListStatusPill` | Píldora de estado con tono. |
| `ListShortDate` | Fecha corta en el calendario de la empresa; `formatListShortDate` (`src/lib/list-short-date.ts`) es el mismo texto para frases y avisos. |
| `ListFooter` + `listFooterPagination(table)` | Pie con conteo, extra, paginador o «Cargar más». |
| `ListLoading`, `ListError`, `ListEmpty`, `ListNoResults` | Estados de la lista. |
| `ListBulkBar` + `ListBulkBarButton` | Barra flotante de selección múltiple. |
| `ListFilterBarShell`, `ButtonFilterGroup`, `MobileSortSelect` | La hoja de filtros de teléfono (antes `list-filter/`). |

`src/lib/list-standard.test.ts` hace cumplir el estándar: nada de `[&_th]:` / `[&_td]:` fuera de `ui/table.tsx`, ni `MoreVertical` en componentes de lista, ni `SortableHeader`, `shortDate` o `useDesktopViewport` propios.

## Ejemplo de página

```tsx
'use client';

import { useMemo, useState } from 'react';
import { useReactTable, getCoreRowModel, type ColumnDef, type SortingState } from '@tanstack/react-table';
import { Plus, Pencil, Trash2 } from 'lucide-react';

import { DesktopSwitch } from '@/components/desktop-switch';
import { Button } from '@/components/ui/button';
import {
  LIST_PAGE_SIZE,
  ListDesktopTitle,
  ListEmpty,
  ListError,
  ListFilterSelect,
  ListFooter,
  ListLoading,
  ListNoResults,
  ListRowMenu,
  ListShortDate,
  ListSortableHeader,
  ListStatusPill,
  ListTable,
  ListTableCard,
  ListToolbar,
  listFooterPagination,
} from '@/components/list-page';

const columns: ColumnDef<Item>[] = [
  { accessorKey: 'name', header: ({ column }) => <ListSortableHeader column={column} label="Cliente" /> },
  { accessorKey: 'date', header: ({ column }) => <ListSortableHeader column={column} label="Fecha" />,
    cell: ({ row }) => <ListShortDate date={row.original.date} />, meta: { className: 'w-28' } },
  { accessorKey: 'total', meta: { align: 'right', className: 'w-32' },
    header: ({ column }) => <ListSortableHeader column={column} label="Total" align="right" /> },
  { id: 'status', header: 'Estado', enableSorting: false,
    cell: ({ row }) => <ListStatusPill tone={row.original.paid ? 'emerald' : 'amber'}>{row.original.paid ? 'Pagado' : 'Parcial'}</ListStatusPill> },
  { id: 'actions', enableSorting: false, meta: { className: 'w-12' },
    header: () => <span className="sr-only">Acciones</span>,
    cell: ({ row }) => (
      <ListRowMenu label={`Acciones de ${row.original.name}`} items={[
        { label: 'Editar', icon: <Pencil className="h-4 w-4" />, onSelect: () => edit(row.original) },
        { label: 'Eliminar', icon: <Trash2 className="h-4 w-4" />, onSelect: () => remove(row.original), destructive: true },
      ]} />
    ) },
];

export const ItemsDesktop = ({ data, total, loading, refreshing, error, retry }: Props) => {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: LIST_PAGE_SIZE });
  const table = useReactTable({
    data, columns, rowCount: total,
    state: { sorting, pagination },
    onSortingChange: setSorting, onPaginationChange: setPagination,
    manualSorting: true, manualPagination: true,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <>
      <ListDesktopTitle title="Tickets" count={total} description="Todo el trabajo de la empresa."
        actions={<Button><Plus className="h-4 w-4" />Nuevo ticket</Button>} />
      <ListToolbar search={…} filters={<ListFilterSelect … />} hasActiveFilters={…} onClear={…} />
      {loading ? <ListLoading label="Cargando tickets" columns={5} />
        : error ? <ListError onRetry={retry} />
        : total === 0 && !filtered ? <ListEmpty title="Sin tickets" description="…" action={…} />
        : total === 0 ? <ListNoResults onClear={…} />
        : (
          <ListTableCard footer={<ListFooter total={total} noun="tickets" pagination={listFooterPagination(table)} />}>
            <ListTable table={table} ariaLabel="Tickets" busy={refreshing}
              getRowHref={(row) => `/tickets/${row.original.id}`} rowTestId="tickets-row" />
          </ListTableCard>
        )}
    </>
  );
};
```

Para el árbol de teléfono, envuelve: `<DesktopSwitch phone={<ItemsPhone … />} desktop={<ItemsDesktop … />} />`.
