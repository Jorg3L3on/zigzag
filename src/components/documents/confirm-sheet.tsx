'use client';

import * as React from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';

type ConfirmSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  /** What is at stake: client, total, payments... shown between body and buttons. */
  summary?: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void | Promise<void>;
  /** Red primary button (default); false for a neutral confirmation. */
  destructive?: boolean;
  pending?: boolean;
};

/**
 * Confirmation for consequential actions (ZIG-I13-1): a bottom sheet on mobile,
 * a dialog from `md` up. The primary button is the action itself, named for
 * what it does ("Eliminar ticket"), and the secondary keeps things as they are.
 */
export const ConfirmSheet = ({
  open,
  onOpenChange,
  title,
  description,
  summary,
  confirmLabel,
  cancelLabel = 'Cancelar',
  onConfirm,
  destructive = true,
  pending = false,
}: ConfirmSheetProps) => {
  const isMobile = useIsMobile();

  const buttons = (
    <>
      <Button
        type="button"
        variant={destructive ? 'destructive' : 'default'}
        className="h-12 w-full rounded-xl sm:h-10 sm:w-auto"
        disabled={pending}
        onClick={() => void onConfirm()}
        data-testid="confirm-sheet-confirm"
      >
        {confirmLabel}
      </Button>
      <Button
        type="button"
        variant="outline"
        className="h-12 w-full rounded-xl sm:h-10 sm:w-auto"
        disabled={pending}
        onClick={() => onOpenChange(false)}
        data-testid="confirm-sheet-cancel"
      >
        {cancelLabel}
      </Button>
    </>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="max-h-[85dvh] overflow-y-auto rounded-t-2xl pb-[max(1.5rem,env(safe-area-inset-bottom))]"
          data-testid="confirm-sheet"
        >
          <SheetHeader className="pr-10 text-left">
            <SheetTitle className="[overflow-wrap:anywhere]">{title}</SheetTitle>
            {description ? (
              <SheetDescription className="[overflow-wrap:anywhere]">
                {description}
              </SheetDescription>
            ) : (
              <SheetDescription className="sr-only">{title}</SheetDescription>
            )}
          </SheetHeader>
          {summary ? <div className="mt-4">{summary}</div> : null}
          <SheetFooter className="mt-6 gap-2 sm:flex-col sm:space-x-0">
            {buttons}
          </SheetFooter>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="confirm-sheet">
        <DialogHeader>
          <DialogTitle className="[overflow-wrap:anywhere]">{title}</DialogTitle>
          {description ? (
            <DialogDescription className="[overflow-wrap:anywhere]">
              {description}
            </DialogDescription>
          ) : (
            <DialogDescription className="sr-only">{title}</DialogDescription>
          )}
        </DialogHeader>
        {summary}
        <DialogFooter className="gap-2 sm:flex-row-reverse sm:space-x-0">
          {buttons}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
