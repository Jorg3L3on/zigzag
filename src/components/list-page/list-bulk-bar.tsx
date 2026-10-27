'use client';

import type { ComponentProps, ReactNode } from 'react';

import { Button } from '@/components/ui/button';

/** An action on the dark bar; pass it to `Button className` or use `ListBulkBarButton`. */
export const LIST_BULK_BAR_ACTION_CLASS = 'h-9 text-background hover:bg-background/15 hover:text-background';
export const LIST_BULK_BAR_DESTRUCTIVE_CLASS = 'h-9 text-red-300 hover:bg-background/15 hover:text-red-200';

export const ListBulkBarButton = ({
  destructive,
  className,
  ...props
}: ComponentProps<typeof Button> & { destructive?: boolean }) => (
  <Button
    type="button"
    variant="ghost"
    className={className ?? (destructive ? LIST_BULK_BAR_DESTRUCTIVE_CLASS : LIST_BULK_BAR_ACTION_CLASS)}
    {...props}
  />
);

/**
 * The floating bar of a multiple selection (ZIG-I33 §4, from Recordatorios, ZIG-I30):
 * the count, the page's actions and Cancelar. Hidden with nothing selected.
 */
export const ListBulkBar = ({
  count,
  children,
  onCancel,
  label = 'Acciones de la selección',
  testId,
}: {
  count: number;
  children: ReactNode;
  onCancel: () => void;
  label?: string;
  testId?: string;
}) => {
  if (count === 0) return null;
  return (
    <div
      role="toolbar"
      aria-label={label}
      data-testid={testId}
      className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-1 rounded-2xl bg-foreground px-3 py-2 text-background shadow-xl"
    >
      <span className="px-2 text-sm font-medium tabular-nums">
        {count === 1 ? '1 seleccionado' : `${count} seleccionados`}
      </span>
      {children}
      <Button
        type="button"
        variant="ghost"
        className="h-9 text-background/80 hover:bg-background/15 hover:text-background"
        onClick={onCancel}
      >
        Cancelar
      </Button>
    </div>
  );
};
