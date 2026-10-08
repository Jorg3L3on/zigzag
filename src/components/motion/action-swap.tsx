'use client';

import * as React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

import { cn } from '@/lib/utils';

export type ActionSwapProps = {
  /** Changing this key swaps the content (e.g. 'idle' → 'saving' → 'done'). */
  swapKey: string;
  children: React.ReactNode;
  className?: string;
};

/**
 * CTA label / icon swap (beui Action Swap): the old content slides up and blurs
 * out while the new one rises in. Use inside a Button for idle → saving → done.
 * Reduced motion swaps instantly (duration 0, same markup).
 */
export const ActionSwap = ({ swapKey, children, className }: ActionSwapProps) => {
  const reduceMotion = useReducedMotion();

  // Same markup either way (hydration-safe); reduced motion only zeroes the timing.
  return (
    <span className={cn('relative inline-grid overflow-hidden', className)}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={swapKey}
          data-swap-key={swapKey}
          className="col-start-1 row-start-1 inline-flex items-center justify-center gap-2"
          initial={{ y: '60%', opacity: 0, filter: 'blur(4px)' }}
          animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
          exit={{ y: '-60%', opacity: 0, filter: 'blur(4px)' }}
          transition={
            reduceMotion
              ? { duration: 0 }
              : { type: 'spring', stiffness: 420, damping: 32, mass: 0.6 }
          }
        >
          {children}
        </motion.span>
      </AnimatePresence>
    </span>
  );
};
