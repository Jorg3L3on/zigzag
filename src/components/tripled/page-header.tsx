'use client';

import { SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { TripledMotionDiv, tripledFadeInUp } from '@/components/tripled/motion';

type BreadcrumbItemType = {
  label: string;
  href?: string;
};

type TripledPageHeaderProps = {
  items: BreadcrumbItemType[];
};

export const TripledPageHeader = ({ items }: TripledPageHeaderProps) => {
  return (
    <TripledMotionDiv
      variants={tripledFadeInUp}
      initial="hidden"
      animate="visible"
      className="flex h-16 shrink-0 items-center gap-2 border-b bg-background/95 backdrop-blur"
    >
      <div className="flex items-center gap-2 px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Breadcrumb>
          <BreadcrumbList>
            {items.map((item, index) => {
              const isLast = index === items.length - 1;

              return (
                <div className="flex items-center" key={`${item.label}-${index}`}>
                  <BreadcrumbItem className={isLast ? '' : 'hidden md:block'}>
                    {isLast ? (
                      <BreadcrumbPage>{item.label}</BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink href={item.href ?? '#'}>{item.label}</BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                  {!isLast ? (
                    <BreadcrumbSeparator className="hidden md:block" />
                  ) : null}
                </div>
              );
            })}
          </BreadcrumbList>
        </Breadcrumb>
      </div>
    </TripledMotionDiv>
  );
};
