'use client';

import { usePathname } from 'next/navigation';

import { TripledPageHeader } from '@/components/tripled';
import { COMPANY_HUB_PATH, getCompanyHubTabLabel } from '@/lib/company-hub';

/** Desktop breadcrumb: Mi empresa › <tab>. */
export const CompanyHubPageHeader = () => {
  const pathname = usePathname();
  const tabLabel = getCompanyHubTabLabel(pathname ?? '');

  return (
    <TripledPageHeader
      items={
        tabLabel
          ? [{ label: 'Mi empresa', href: COMPANY_HUB_PATH }, { label: tabLabel }]
          : [{ label: 'Mi empresa' }]
      }
      className="hidden md:flex"
    />
  );
};
