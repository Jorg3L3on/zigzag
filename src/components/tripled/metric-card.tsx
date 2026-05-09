'use client';

import type { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TripledMotionDiv, tripledFadeInUp } from '@/components/tripled/motion';

type TripledMetricCardProps = {
  title: string;
  icon: ReactNode;
  value: ReactNode;
  subtitle?: ReactNode;
};

export const TripledMetricCard = ({
  title,
  icon,
  value,
  subtitle,
}: TripledMetricCardProps) => {
  return (
    <TripledMotionDiv variants={tripledFadeInUp}>
      <Card className="border-border/60 bg-gradient-to-b from-card to-card/80 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {title}
          </CardTitle>
          {icon}
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-semibold">{value}</div>
          {subtitle ? (
            <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
          ) : null}
        </CardContent>
      </Card>
    </TripledMotionDiv>
  );
};
