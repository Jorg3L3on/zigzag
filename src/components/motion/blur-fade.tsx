'use client';

import * as React from 'react';
import {
  motion,
  useInView,
  useReducedMotion,
  type HTMLMotionProps,
} from 'framer-motion';

import { cn } from '@/lib/utils';

export type BlurFadeProps = Omit<
  HTMLMotionProps<'div'>,
  'initial' | 'animate' | 'transition'
> & {
  /** Seconds before the entrance starts (stagger siblings with 0.04 steps). */
  delay?: number;
  /** Seconds the entrance takes. */
  duration?: number;
  /** Vertical travel in px. */
  offset?: number;
  /** Blur radius at the start, in px. */
  blur?: number;
  /** Wait until the element scrolls into view (once). */
  inView?: boolean;
};

/**
 * Section / list entrance: fade + slight rise + blur clearing (magicui Blur Fade).
 * Reduced motion snaps to the final state (duration 0). Markup never depends on
 * the preference: useReducedMotion can differ between SSR and the first client
 * render, and a different branch would break hydration.
 */
export const BlurFade = ({
  children,
  className,
  delay = 0,
  duration = 0.4,
  offset = 6,
  blur = 6,
  inView = false,
  ...props
}: BlurFadeProps) => {
  const ref = React.useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const isInView = useInView(ref, { once: true, margin: '-40px' });
  const visible = !inView || isInView;

  return (
    <motion.div
      ref={ref}
      data-blur-fade
      className={cn(className)}
      initial={{ opacity: 0, y: offset, filter: `blur(${blur}px)` }}
      animate={
        visible
          ? { opacity: 1, y: 0, filter: 'blur(0px)' }
          : { opacity: 0, y: offset, filter: `blur(${blur}px)` }
      }
      transition={
        reduceMotion
          ? { duration: 0 }
          : { delay, duration, ease: [0.22, 1, 0.36, 1] }
      }
      {...props}
    >
      {children}
    </motion.div>
  );
};
