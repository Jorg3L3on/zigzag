'use client';

import {
  motion,
  useReducedMotion,
  type HTMLMotionProps,
  type Variants,
} from 'framer-motion';
import { useMemo } from 'react';

export const tripledFadeInUp: Variants = {
  hidden: { opacity: 0, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: 'easeOut' },
  },
};

export const tripledStagger: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08 },
  },
};

const instantTransition = {
  duration: 0,
  delay: 0,
  staggerChildren: 0,
  delayChildren: 0,
};

// A variant's own transition wins over the component's, so each one is made instant.
const instantVariants = (variants: Variants): Variants =>
  Object.fromEntries(
    Object.entries(variants).map(([name, variant]) => [
      name,
      typeof variant === 'function'
        ? (...args: Parameters<typeof variant>) => {
            const resolved = variant(...args);
            return typeof resolved === 'string'
              ? resolved
              : { ...resolved, transition: instantTransition };
          }
        : { ...variant, transition: instantTransition },
    ]),
  );

export const TripledMotionDiv = ({
  animate,
  initial,
  transition,
  variants,
  ...props
}: HTMLMotionProps<'div'>) => {
  const shouldReduceMotion = useReducedMotion();
  const reducedVariants = useMemo(
    () => (variants ? instantVariants(variants) : undefined),
    [variants],
  );

  // The server always renders the `initial` state inline. Reduced motion still
  // runs initial → animate, only instantly, so framer-motion writes the final
  // style after hydration instead of leaving the SSR `opacity: 0` in place.
  if (shouldReduceMotion) {
    return (
      <motion.div
        {...props}
        animate={animate}
        initial={initial}
        transition={{ ...transition, ...instantTransition }}
        variants={reducedVariants}
      />
    );
  }

  return (
    <motion.div
      {...props}
      animate={animate}
      initial={initial}
      transition={transition}
      variants={variants}
    />
  );
};
