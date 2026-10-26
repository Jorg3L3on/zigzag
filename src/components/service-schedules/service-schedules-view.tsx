'use client';

import * as React from 'react';
import { ServiceSchedulesAgenda } from '@/components/service-schedules/service-schedules-agenda';
import { ServiceSchedulesList } from '@/components/service-schedules/service-schedules-list';
import { TripledListLoadingState } from '@/components/tripled';
import { MOBILE_BREAKPOINT_PX } from '@/lib/breakpoints';

const PHONE_QUERY = `(max-width: ${MOBILE_BREAKPOINT_PX - 1}px)`;

const subscribe = (onChange: () => void) => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return () => undefined;
  }
  const query = window.matchMedia(PHONE_QUERY);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
};

const getSnapshot = () =>
  typeof window.matchMedia === 'function' ? window.matchMedia(PHONE_QUERY).matches : false;

/**
 * Phones keep the cards (ServiceSchedulesList); from md the page is the agenda
 * (ZIG-I30). Until the browser says which, the list's own loading state shows,
 * so only one of them mounts and loads data.
 */
export const ServiceSchedulesView = () => {
  const isPhone = React.useSyncExternalStore<boolean | null>(subscribe, getSnapshot, () => null);

  if (isPhone === null) {
    return (
      <TripledListLoadingState
        label="Cargando lista de recordatorios"
        desktopColumns={6}
        desktopRows={5}
      />
    );
  }
  return isPhone ? <ServiceSchedulesList /> : <ServiceSchedulesAgenda />;
};
