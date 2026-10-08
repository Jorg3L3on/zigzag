'use client';

import { usePathname } from 'next/navigation';

import { TripledMobileAppBar, TripledPageHeader } from '@/components/tripled';
import {
  COMPANY_HUB_PATH,
  getCompanyHubSubpage,
  getCompanyHubTabLabel,
} from '@/lib/company-hub';

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

/** Mobile app bar: Mi empresa on tabs, back + title on full-screen sub-pages. */
export const CompanyHubMobileAppBar = ({ companyName }: { companyName: string }) => {
  const pathname = usePathname();
  const subpage = getCompanyHubSubpage(pathname ?? '');

  return subpage ? (
    <TripledMobileAppBar
      title={subpage.title}
      subtitle={companyName}
      backHref={subpage.backHref}
      backLabel={subpage.backLabel}
      className="mb-3"
    />
  ) : (
    <TripledMobileAppBar title="Mi empresa" subtitle={companyName} className="mb-3" />
  );
};
