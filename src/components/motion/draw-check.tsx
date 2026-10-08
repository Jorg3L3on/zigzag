'use client';

import { motion, useReducedMotion } from 'framer-motion';

import { cn } from '@/lib/utils';

export type DrawCheckProps = {
  className?: string;
  /** Seconds before the circle starts drawing. */
  delay?: number;
};

/**
 * Success mark that draws itself (circle, then tick), like easyui DrawCheckbox /
 * beui success-check. Reduced motion renders the finished mark.
 */
export const DrawCheck = ({ className, delay = 0 }: DrawCheckProps) => {
  const reduceMotion = useReducedMotion();
  const draw = (start: number, duration: number) =>
    reduceMotion
      ? { initial: false as const }
      : {
          initial: { pathLength: 0, opacity: 0 },
          animate: { pathLength: 1, opacity: 1 },
          transition: {
            pathLength: { delay: delay + start, duration, ease: [0.22, 1, 0.36, 1] as const },
            opacity: { delay: delay + start, duration: 0.01 },
          },
        };

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      data-draw-check={reduceMotion ? 'static' : 'animated'}
      className={cn('size-6', className)}
    >
      <motion.circle cx="12" cy="12" r="10" {...draw(0, 0.45)} />
      <motion.path d="M7.5 12.5l3 3 6-6.5" {...draw(0.35, 0.35)} />
    </svg>
  );
};
