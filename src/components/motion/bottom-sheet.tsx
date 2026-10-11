'use client';

import * as React from 'react';
import { Dialog as SheetPrimitive } from 'radix-ui';
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type PanInfo,
  type Transition,
} from 'framer-motion';

import {
  Sheet,
  SheetDescription,
  SheetOverlay,
  SheetPortal,
  SheetTitle,
} from '@/components/ui/sheet';
import { focusInitialOverlayTarget } from '@/lib/overlay-focus';
import { cn } from '@/lib/utils';

const SHEET_SPRING: Transition = {
  type: 'spring',
  stiffness: 380,
  damping: 36,
  mass: 0.8,
};

const INSTANT: Transition = { duration: 0 };

/** Drag distance (px) or fling speed (px/s) that dismisses from the lowest snap. */
const DISMISS_OFFSET_PX = 120;
const DISMISS_VELOCITY = 800;

export type BottomSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Hide title/description visually (still announced). */
  hideHeader?: boolean;
  /**
   * Replaces the visible header (the title and description stay announced, hidden
   * visually): lets a sheet lay out an eyebrow, a long name and actions its own way.
   */
  header?: React.ReactNode;
  /**
   * Heights as fractions of the viewport, ascending (e.g. [0.5, 0.9]).
   * Omit for an auto-height sheet (max 92dvh) that only drags down to dismiss.
   */
  snapPoints?: number[];
  /** Index into snapPoints to open at (default: the first). */
  initialSnap?: number;
  footer?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  'data-testid'?: string;
};

const viewportHeight = () =>
  typeof window === 'undefined' ? 800 : window.innerHeight;

/** Pick the snap closest to where a drag would land; null means dismiss. */
export const resolveSnapAfterDrag = ({
  snapPoints,
  currentIndex,
  offsetY,
  velocityY,
  viewport,
}: {
  snapPoints: number[];
  currentIndex: number;
  offsetY: number;
  velocityY: number;
  viewport: number;
}): number | null => {
  const currentHeight = snapPoints[currentIndex] * viewport;
  const projectedHeight = currentHeight - offsetY - velocityY * 0.2;
  const lowest = snapPoints[0] * viewport;

  if (
    velocityY > DISMISS_VELOCITY ||
    projectedHeight < lowest - DISMISS_OFFSET_PX
  ) {
    return null;
  }

  let best = 0;
  snapPoints.forEach((point, index) => {
    if (
      Math.abs(point * viewport - projectedHeight) <
      Math.abs(snapPoints[best] * viewport - projectedHeight)
    ) {
      best = index;
    }
  });
  return best;
};

/**
 * Draggable bottom sheet with optional snap points (beui Bottom Sheet), built on
 * the app's Radix Sheet (focus trap, Escape, overlay click, aria). Drag the
 * handle or body down to dismiss; fling up/down to move between snaps.
 * Reduced motion keeps dragging but drops the spring.
 */
export const BottomSheet = ({
  open,
  onOpenChange,
  title,
  description,
  hideHeader = false,
  header,
  snapPoints,
  initialSnap = 0,
  footer,
  children,
  className,
  'data-testid': testId,
}: BottomSheetProps) => {
  const reduceMotion = useReducedMotion();
  const contentRef = React.useRef<HTMLDivElement>(null);
  const [snapIndex, setSnapIndex] = React.useState(initialSnap);
  const transition = reduceMotion ? INSTANT : SHEET_SPRING;

  React.useEffect(() => {
    if (open) {
      setSnapIndex(initialSnap);
    }
  }, [open, initialSnap]);

  const maxSnap = snapPoints ? snapPoints[snapPoints.length - 1] : null;
  const restingY =
    snapPoints && maxSnap !== null
      ? (maxSnap - snapPoints[snapIndex]) * viewportHeight()
      : 0;

  const handleDragEnd = (
    _event: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo,
  ) => {
    if (!snapPoints) {
      if (
        info.offset.y > DISMISS_OFFSET_PX ||
        info.velocity.y > DISMISS_VELOCITY
      ) {
        onOpenChange(false);
      }
      return;
    }

    const next = resolveSnapAfterDrag({
      snapPoints,
      currentIndex: snapIndex,
      offsetY: info.offset.y,
      velocityY: info.velocity.y,
      viewport: viewportHeight(),
    });
    if (next === null) {
      onOpenChange(false);
      return;
    }
    setSnapIndex(next);
  };

  const headerClass = hideHeader || header ? 'sr-only' : undefined;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open ? (
          <SheetPortal forceMount>
            <SheetOverlay forceMount className="bg-black/50" />
            <SheetPrimitive.Content
              asChild
              forceMount
              onOpenAutoFocus={(event) =>
                focusInitialOverlayTarget(event, contentRef.current)
              }
              // A tap on a toast (Deshacer after quitting a material) is outside
              // the sheet but must not dismiss it (ZIG-I13-2).
              onInteractOutside={(event) => {
                const target = event.target as HTMLElement | null;
                if (target?.closest('[data-sonner-toaster]')) event.preventDefault();
              }}
            >
              <motion.div
                ref={contentRef}
                data-testid={testId}
                data-snap-index={snapPoints ? snapIndex : undefined}
                className={cn(
                  'fixed inset-x-0 bottom-0 z-50 mx-auto flex w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-b-0 bg-background shadow-panel outline-none',
                  !snapPoints && 'max-h-[92dvh]',
                  className,
                )}
                style={
                  maxSnap !== null ? { height: `${maxSnap * 100}dvh` } : undefined
                }
                initial={{ y: '100%' }}
                animate={{ y: restingY }}
                exit={{ y: '100%' }}
                transition={transition}
                drag="y"
                dragConstraints={{ top: 0, bottom: 0 }}
                dragElastic={{ top: 0.04, bottom: 0.7 }}
                dragMomentum={false}
                onDragEnd={handleDragEnd}
              >
                <div
                  aria-hidden
                  className="flex shrink-0 cursor-grab touch-none justify-center pb-1 pt-3 active:cursor-grabbing"
                >
                  <span className="h-1.5 w-10 rounded-full bg-muted-foreground/30" />
                </div>
                <div className={cn('shrink-0 px-5 pb-3 pt-1', headerClass)}>
                  <SheetTitle className="text-base">{title}</SheetTitle>
                  {description ? (
                    <SheetDescription>{description}</SheetDescription>
                  ) : null}
                </div>
                {header ? <div className="shrink-0 px-5 pb-3 pt-1">{header}</div> : null}
                <div
                  className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4"
                  onPointerDownCapture={(event) => {
                    // Let inputs and scrollable content work without starting a drag.
                    const target = event.target as HTMLElement;
                    if (target.closest('input, textarea, select, [data-no-drag]')) {
                      event.stopPropagation();
                    }
                  }}
                >
                  {children}
                </div>
                {footer ? (
                  <div className="shrink-0 border-t bg-background px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
                    {footer}
                  </div>
                ) : (
                  <div aria-hidden className="h-[env(safe-area-inset-bottom)] shrink-0" />
                )}
              </motion.div>
            </SheetPrimitive.Content>
          </SheetPortal>
        ) : null}
      </AnimatePresence>
    </Sheet>
  );
};
