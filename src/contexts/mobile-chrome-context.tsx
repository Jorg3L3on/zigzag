'use client';

import * as React from 'react';

type MobileChromeContextValue = {
  stickyActionCount: number;
  registerStickyAction: () => () => void;
  hasStickyAction: boolean;
};

const MobileChromeContext = React.createContext<MobileChromeContextValue | null>(
  null,
);

export const MobileChromeProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [stickyActionCount, setStickyActionCount] = React.useState(0);

  const registerStickyAction = React.useCallback(() => {
    setStickyActionCount((count) => count + 1);
    return () => {
      setStickyActionCount((count) => Math.max(0, count - 1));
    };
  }, []);

  const value = React.useMemo(
    () => ({
      stickyActionCount,
      registerStickyAction,
      hasStickyAction: stickyActionCount > 0,
    }),
    [stickyActionCount, registerStickyAction],
  );

  return (
    <MobileChromeContext.Provider value={value}>
      {children}
    </MobileChromeContext.Provider>
  );
};

export const useMobileChrome = (): MobileChromeContextValue => {
  const context = React.useContext(MobileChromeContext);
  if (!context) {
    return {
      stickyActionCount: 0,
      registerStickyAction: () => () => undefined,
      hasStickyAction: false,
    };
  }
  return context;
};

/** Register a mounted sticky action bar so the bottom tab bar can hide. */
export const useRegisterMobileStickyAction = () => {
  const { registerStickyAction } = useMobileChrome();
  React.useEffect(() => registerStickyAction(), [registerStickyAction]);
};
