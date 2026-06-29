import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';

export const TicketsListSkeleton = () => (
  <div
    className="space-y-4"
    aria-busy="true"
    aria-live="polite"
    aria-label="Cargando tabla de tickets"
  >
    <div className="flex flex-col gap-3">
      <div className="flex gap-2 lg:hidden">
        <Skeleton className="h-10 min-w-0 flex-1" />
        <Skeleton className="h-10 w-10 shrink-0 rounded-md" />
      </div>
      <Skeleton className="hidden h-10 w-full lg:block" />
      <div className="hidden gap-3 lg:flex lg:flex-wrap lg:items-center">
        <Skeleton className="h-10 min-w-[12rem] max-w-[15rem]" />
        <Skeleton className="h-10 min-w-[9rem] max-w-[12rem]" />
        <Skeleton className="h-10 min-w-[11rem] max-w-[14rem]" />
        <Skeleton className="h-10 min-w-[14rem] max-w-[17rem]" />
      </div>
      <Skeleton className="h-4 w-56" />
    </div>
    <div className="hidden rounded-xl border border-border/70 shadow-sm md:block">
      <Table
        className={
          '[&_td]:py-2.5 [&_th]:h-10 [&_th]:py-2 [&_th]:align-middle [&_tr]:border-border/60'
        }
      >
        <TableHeader>
          <TableRow>
            {Array.from({ length: 7 }).map((_, i) => (
              <TableHead key={i}>
                <Skeleton className="h-8 w-24" />
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 8 }).map((_, row) => (
            <TableRow key={row}>
              {Array.from({ length: 7 }).map((__, col) => (
                <TableCell key={col}>
                  <Skeleton className="h-5 w-full max-w-[8rem]" />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
    <div className="space-y-3 md:hidden">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-36 w-full rounded-md" />
      ))}
    </div>
  </div>
);
