'use client';

import * as React from 'react';
import { getCompanyPaymentInfo } from '@/actions/company-payment-info';
import { useCompany } from '@/contexts/company-context';
import type { CompanyPaymentInfo } from '@/lib/company-payment-info';

const cache = new Map<string, Promise<CompanyPaymentInfo | null>>();

const load = (companyId: number | null): Promise<CompanyPaymentInfo | null> => {
  const key = String(companyId ?? 'own');
  let pending = cache.get(key);
  if (!pending) {
    pending = getCompanyPaymentInfo(companyId)
      .then((result) => (result.success ? (result.data ?? null) : null))
      .catch(() => null);
    cache.set(key, pending);
  }
  return pending;
};

/** Test seam: forget what was loaded (the hook caches per company for the session). */
export const resetCompanyPaymentInfoCache = () => cache.clear();

/**
 * The selected company's transfer data for WhatsApp messages (ZIG-I20-1).
 * Null until loaded or when the company set nothing, so a message built before
 * the data arrives is simply the plain message.
 */
export const useCompanyPaymentInfo = (): CompanyPaymentInfo | null => {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id ?? null;
  const [info, setInfo] = React.useState<CompanyPaymentInfo | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    void load(companyId).then((loaded) => {
      if (!cancelled) setInfo(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  return info;
};
