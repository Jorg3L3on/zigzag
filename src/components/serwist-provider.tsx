'use client';

import { SerwistProvider as TurbopackSerwistProvider } from '@serwist/turbopack/react';
import {
  SERWIST_SCOPE,
  SERWIST_SW_URL,
  shouldRegisterServiceWorker,
} from '@/lib/register-service-worker';

type AppSerwistProviderProps = {
  children: React.ReactNode;
};

/**
 * Registers the production service worker. Disabled in development so Turbopack
 * HMR is not broken by shell caching.
 */
export function AppSerwistProvider({ children }: AppSerwistProviderProps) {
  const disable = !shouldRegisterServiceWorker();

  return (
    <TurbopackSerwistProvider
      swUrl={SERWIST_SW_URL}
      disable={disable}
      register={!disable}
      cacheOnNavigation={false}
      options={{ scope: SERWIST_SCOPE }}
      reloadOnOnline={false}
    >
      {children}
    </TurbopackSerwistProvider>
  );
}
