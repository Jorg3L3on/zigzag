'use client';

import * as React from 'react';
import { Dialog as SheetPrimitive } from 'radix-ui';
import { AnimatePresence, motion, useReducedMotion, type Transition } from 'framer-motion';
import { X } from 'lucide-react';

import {
  Sheet,
  SheetDescription,
  SheetOverlay,
  SheetPortal,
  SheetTitle,
} from '@/components/ui/sheet';
import { focusInitialOverlayTarget } from '@/lib/overlay-focus';
import { cn } from '@/lib/utils';

const PANEL_SPRING: Transition = {
  type: 'spring',
  stiffness: 420,
  damping: 40,
  mass: 0.8,
};

const INSTANT: Transition = { duration: 0 };

export type SidePanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  /**
   * Replaces the visible header (title and description stay announced, hidden
   * visually), like BottomSheet's `header`.
   */
  header?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  'data-testid'?: string;
};

/**
 * Right-hand panel for desktop (ZIG-I24): the same contract as BottomSheet
 * (title, header, scrolling body, fixed footer) so one form can render as a
 * bottom sheet on phones and as a side panel from 1024px. The page stays
 * visible behind a light overlay; Escape, the overlay or the close button
 * dismiss it.
 */
export const SidePanel = ({
  open,
  onOpenChange,
  title,
  description,
  header,
  footer,
  children,
  className,
  'data-testid': testId,
}: SidePanelProps) => {
  const reduceMotion = useReducedMotion();
  const contentRef = React.useRef<HTMLDivElement>(null);
  const transition = reduceMotion ? INSTANT : PANEL_SPRING;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open ? (
          <SheetPortal forceMount>
            <SheetOverlay forceMount className="bg-black/25" />
            <SheetPrimitive.Content
              asChild
              forceMount
              onOpenAutoFocus={(event) => focusInitialOverlayTarget(event, contentRef.current)}
              // A tap on a toast (Deshacer) is outside the panel but must not dismiss it.
              onInteractOutside={(event) => {
                const target = event.target as HTMLElement | null;
                if (target?.closest('[data-sonner-toaster]')) event.preventDefault();
              }}
            >
              <motion.div
                ref={contentRef}
                data-testid={testId}
                data-panel="side"
                className={cn(
                  'fixed inset-y-0 right-0 z-50 flex w-full max-w-[440px] flex-col border-l bg-background shadow-panel outline-none',
                  className,
                )}
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={transition}
              >
                <div className={cn('flex shrink-0 items-start gap-3 border-b px-6 py-4')}>
                  <div className={cn('min-w-0 flex-1', header && 'sr-only')}>
                    <SheetTitle className="text-base">{title}</SheetTitle>
                    {description ? <SheetDescription>{description}</SheetDescription> : null}
                  </div>
                  {header ? <div className="min-w-0 flex-1">{header}</div> : null}
                  <SheetPrimitive.Close
                    data-overlay-close
                    className="-mr-2 -mt-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <X className="h-4 w-4" aria-hidden />
                    <span className="sr-only">Cerrar</span>
                  </SheetPrimitive.Close>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-4">
                  {children}
                </div>
                {footer ? <div className="shrink-0 border-t bg-background px-6 py-4">{footer}</div> : null}
              </motion.div>
            </SheetPrimitive.Content>
          </SheetPortal>
        ) : null}
      </AnimatePresence>
    </Sheet>
  );
};
