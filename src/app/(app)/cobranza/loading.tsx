import { Banknote } from 'lucide-react';

import { ResourceRouteLoading } from '@/components/route-loading-skeletons';

export default function Loading() {
  return (
    <ResourceRouteLoading
      title="Cobranza"
      description="Quién te debe y desde cuándo."
      icon={<Banknote className="size-5" aria-hidden />}
      label="Cargando cobranza"
    />
  );
}
