import {
  LIST_TABLE_CARD_CLASS,
  LIST_TABLE_CLASS,
  LIST_TABLE_PADDING_CLASS,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/**
 * The list while it loads, in the list's own shape (ZIG-28): from lg (the DesktopSwitch
 * breakpoint, ZIG-I33) the view tabs, one filter row and the list table in its card;
 * below lg the search row and the cards.
 */
export const TicketsListSkeleton = ({ label = 'Cargando tabla de tickets' }: { label?: string }) => (
  <div className="space-y-4" aria-busy="true" aria-live="polite" aria-label={label}>
    <div className="flex flex-col gap-3 lg:hidden">
      <div className="flex gap-2">
        <Skeleton className="h-10 min-w-0 flex-1" />
        <Skeleton className="h-10 w-10 shrink-0 rounded-md" />
      </div>
      <Skeleton className="h-4 w-56" />
    </div>
    <div className="hidden flex-col gap-3 lg:flex">
      <div className="flex gap-1 border-b border-border/60">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-1.5 px-4 pb-2.5 pt-1">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-3 w-14" />
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-11 min-w-[12rem] max-w-[360px] flex-1 rounded-xl" />
        <Skeleton className="h-11 w-40 rounded-full" />
        <Skeleton className="h-11 w-32 rounded-full" />
        <div className="ml-auto flex items-center gap-2">
          <Skeleton className="h-11 w-36 rounded-full" />
          <Skeleton className="h-11 w-28 rounded-full" />
        </div>
      </div>
    </div>
    <div className={cn('hidden lg:block', LIST_TABLE_CARD_CLASS)}>
      <Table className={cn(LIST_TABLE_CLASS, LIST_TABLE_PADDING_CLASS)}>
        <TableHeader>
          <TableRow>
            {Array.from({ length: 6 }).map((_, i) => (
              <TableHead key={i}>
                <Skeleton className="h-4 w-16" />
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 8 }).map((_, row) => (
            <TableRow key={row}>
              {Array.from({ length: 6 }).map((__, col) => (
                <TableCell key={col}>
                  <Skeleton className="h-5 w-full max-w-[8rem]" />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
    <div className="space-y-3 lg:hidden">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-36 w-full rounded-md" />
      ))}
    </div>
  </div>
);
