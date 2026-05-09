'use client';

import type { ReactNode } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type TripledDataPanelProps = {
  title: string;
  description: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  ctaLabel: string;
  onCtaClick: () => void;
  children: ReactNode;
};

export const TripledDataPanel = ({
  title,
  description,
  searchValue,
  onSearchChange,
  ctaLabel,
  onCtaClick,
  children,
}: TripledDataPanelProps) => {
  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>{title}</CardTitle>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          <Button
            onClick={onCtaClick}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
          >
            {ctaLabel}
          </Button>
        </div>
        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Buscar..."
            className="pl-9"
          />
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
};
