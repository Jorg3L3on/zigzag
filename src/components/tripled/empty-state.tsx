'use client';

import type { ReactNode } from 'react';

type TripledEmptyStateProps = {
  icon: ReactNode;
  title: string;
  description: string;
};

export const TripledEmptyState = ({
  icon,
  title,
  description,
}: TripledEmptyStateProps) => {
  return (
    <div className="rounded-xl border border-dashed p-10 text-center">
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted">
        {icon}
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
};
