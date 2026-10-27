'use client';

import { DesktopSwitch } from '@/components/desktop-switch';
import { ServiceSchedulesAgenda } from '@/components/service-schedules/service-schedules-agenda';
import { ServiceSchedulesList } from '@/components/service-schedules/service-schedules-list';

/**
 * Phones keep the cards (ServiceSchedulesList); from lg the page is the agenda
 * (ZIG-I30, list standard ZIG-I33-5). DesktopSwitch keeps only one of them mounted
 * once the width is known.
 */
export const ServiceSchedulesView = () => (
  <DesktopSwitch phone={<ServiceSchedulesList />} desktop={<ServiceSchedulesAgenda />} />
);
