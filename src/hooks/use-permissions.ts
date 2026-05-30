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

export function usePermissions() {
  const [permissionMap, setPermissionMap] =
    React.useState<PermissionMap>(EMPTY_PERMISSION_MAP);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let isMounted = true;

    const loadPermissions = async () => {
      try {
        const nextPermissionMap = await getSessionPermissionMap();
        if (isMounted) {
          setPermissionMap(nextPermissionMap);
        }
      } catch (error) {
        console.error('Error fetching permissions:', error);
        if (isMounted) {
          setPermissionMap(EMPTY_PERMISSION_MAP);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void loadPermissions();

    return () => {
      isMounted = false;
    };
  }, []);

  const can = React.useCallback(
    (permission?: PermissionName | string) =>
      canAccessPermission(permissionMap, permission),
    [permissionMap],
  );

  return {
    ...permissionMap,
    loading,
    can,
  };
}
