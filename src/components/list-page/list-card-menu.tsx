'use client';

import Link from 'next/link';
import { MoreVertical } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { ListRowMenuItem } from '@/components/list-page/list-desktop';
import { cn } from '@/lib/utils';

export type ListCardMenuItem = ListRowMenuItem & {
  /** A more specific accessible name («Cobrar R-0060»). */
  ariaLabel?: string;
  /** Navigation: rendered as a real link (new tab, prefetch) instead of `onSelect`. */
  href?: string;
};

type ListCardMenuProps = {
  label: string;
  items: ListCardMenuItem[];
  /** The phone cards size and place the ⋮ themselves; the markup stays as each had it. */
  triggerClassName?: string;
  iconClassName?: string;
  itemClassName?: string;
};

/**
 * The ⋮ menu of a phone list card (below lg, unchanged by ZIG-I33); desktop rows use
 * `ListRowMenu`. Clicks and keys never reach the card.
 */
export const ListCardMenu = ({
  label,
  items,
  triggerClassName,
  iconClassName = 'h-4 w-4',
  itemClassName,
}: ListCardMenuProps) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button
        variant="ghost"
        size="icon"
        className={triggerClassName}
        aria-label={label}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
      >
        <MoreVertical className={iconClassName} aria-hidden data-icon="inline-start" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
      {items.map((item) => {
        const entry = (
          <DropdownMenuItem
            key={item.label}
            className={cn(itemClassName, item.destructive && 'text-destructive focus:text-destructive')}
            disabled={item.disabled}
            aria-label={item.ariaLabel}
            onSelect={item.href ? undefined : item.onSelect}
          >
            {item.icon}
            {item.hint ? `${item.label} (${item.hint})` : item.label}
          </DropdownMenuItem>
        );
        return item.href ? (
          <Link key={item.label} href={item.href}>
            {entry}
          </Link>
        ) : (
          entry
        );
      })}
    </DropdownMenuContent>
  </DropdownMenu>
);
