import * as React from 'react';
import { cn } from '@/lib/utils';

type FieldErrorProps = React.HTMLAttributes<HTMLParagraphElement> & {
  children?: React.ReactNode;
};

/** Visible field-level validation error (FormMessage-compatible surface). */
export const FieldError = ({
  className,
  children,
  ...props
}: FieldErrorProps) => {
  if (!children) {
    return null;
  }

  return (
    <p
      role="alert"
      className={cn('text-sm font-medium text-destructive', className)}
      {...props}
    >
      {children}
    </p>
  );
};
