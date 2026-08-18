'use client';

import * as React from 'react';
import { getSessionPermissionMap } from '@/actions/authz';
import {
  canAccessPermission,
  type PermissionMap,
  type PermissionName,
} from '@/lib/permissions';

const EMPTY_PERMISSION_MAP: PermissionMap = {
  isSystem: false,
  permissions: [],
};

type PermissionsContextValue = PermissionMap & {
  loading: boolean;
  can: (permission?: PermissionName | string) => boolean;
  refresh: () => Promise<void>;
};

const PermissionsContext = React.createContext<PermissionsContextValue | null>(
  null,
);

type PermissionsProviderProps = {
  initialPermissionMap?: PermissionMap;
  children: React.ReactNode;
};

export const PermissionsProvider = ({
  initialPermissionMap,
  children,
}: PermissionsProviderProps) => {
  const [permissionMap, setPermissionMap] = React.useState<PermissionMap>(
    initialPermissionMap ?? EMPTY_PERMISSION_MAP,
  );
  const [loading, setLoading] = React.useState(initialPermissionMap == null);

  const refresh = React.useCallback(async () => {
    try {
      const nextPermissionMap = await getSessionPermissionMap();
      setPermissionMap(nextPermissionMap);
    } catch (error) {
      console.error('Error fetching permissions:', error);
      setPermissionMap(EMPTY_PERMISSION_MAP);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (initialPermissionMap != null) {
      setPermissionMap(initialPermissionMap);
      setLoading(false);
      return;
    }

    void refresh();
  }, [initialPermissionMap, refresh]);

  const can = React.useCallback(
    (permission?: PermissionName | string) =>
      canAccessPermission(permissionMap, permission),
    [permissionMap],
  );

  const value = React.useMemo(
    () => ({
      ...permissionMap,
      loading,
      can,
      refresh,
    }),
    [permissionMap, loading, can, refresh],
  );

  return (
    <PermissionsContext.Provider value={value}>
      {children}
    </PermissionsContext.Provider>
  );
};

export const usePermissions = (): PermissionsContextValue => {
  const context = React.useContext(PermissionsContext);
  if (!context) {
    throw new Error('usePermissions must be used within PermissionsProvider');
  }
  return context;
};
