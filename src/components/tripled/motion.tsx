'use client';

import {
  motion,
  useReducedMotion,
  type HTMLMotionProps,
  type Variants,
} from 'framer-motion';

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

export const TripledMotionDiv = ({
  animate,
  initial,
  transition,
  variants,
  ...props
}: HTMLMotionProps<'div'>) => {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return (
      <motion.div
        {...props}
        initial={false}
        animate={undefined}
        variants={undefined}
        transition={{ ...transition, duration: 0 }}
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
