'use client';

import type { HTMLAttributes, KeyboardEvent, MouseEvent } from 'react';
import { useRouter } from 'next/navigation';

import { TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

/** Controls inside a row handle their own clicks; the row only opens from the rest. */
const INTERACTIVE = 'a, button, input, select, textarea, label, [role="menuitem"], [role="checkbox"]';

type ListClickableRowProps = Omit<HTMLAttributes<HTMLTableRowElement>, 'onClick' | 'onKeyDown'> & {
  /** Opens the element: detail, edit or side panel. */
  onOpen?: () => void;
  /** Or a route to push when there is no `onOpen`. */
  href?: string;
  /** The open or selected row (`data-state=selected`). */
  selected?: boolean;
};

/**
 * A desktop list row that opens its element by click, Enter or Space (ZIG-I33 §4).
 * Clicks and keys on the ⋯ menu, a checkbox or a visible action never reach it.
 */
export const ListClickableRow = ({
  onOpen,
  href,
  selected,
  className,
  children,
  ...props
}: ListClickableRowProps) => {
  const router = useRouter();
  const open = onOpen ?? (href ? () => router.push(href) : undefined);

  const handleClick = (event: MouseEvent<HTMLTableRowElement>) => {
    if (!open) return;
    const target = event.target as HTMLElement;
    if (target.closest(INTERACTIVE)) return;
    open();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTableRowElement>) => {
    if (!open || event.target !== event.currentTarget) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      open();
    }
  };

  return (
    <TableRow
      {...props}
      className={cn('h-14', open && 'cursor-pointer', className)}
      tabIndex={open ? 0 : undefined}
      data-state={selected ? 'selected' : undefined}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      {children}
    </TableRow>
  );
};
