'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function NewServicePage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the edit page with 'new' as the ID
    router.replace('/services/new/edit');
  }, [router]);

  return null;
}
