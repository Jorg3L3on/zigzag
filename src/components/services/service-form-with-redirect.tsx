'use client';

import { useRouter } from 'next/navigation';
import type { Service } from '@/db/schema';
import { ServiceForm } from '@/components/services/service-form';

export function ServiceFormWithRedirect({ service }: { service?: Service }) {
  const router = useRouter();

  return (
    <ServiceForm
      service={service}
      onSuccess={() => {
        router.push('/services');
      }}
    />
  );
}
