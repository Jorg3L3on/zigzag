'use client';

import React from 'react';
import { getCompanyOperatorSummary } from '@/actions/company-operator';
import type { CompanyOperatorSummary } from '@/lib/company-operator-summary';
import { classifyClientError, getErrorMessageByType } from '@/lib/network-awareness';

type OperatorCompanyContextValue = {
  companyId: number;
  summary: CompanyOperatorSummary | null;
  loading: boolean;
  error: string | null;
  /** Re-read the company record; every status change calls it (audit E4). */
  refresh: () => Promise<void>;
};

const OperatorCompanyContext =
  React.createContext<OperatorCompanyContextValue | null>(null);

/**
 * The one company record of the console page (ZIG-I38-2): header, tabs and
 * dialogs read it, and refresh it after any change, so they never disagree.
 * The company comes from the route, never from the app's selected company.
 */
export const OperatorCompanyProvider = ({
  companyId,
  children,
}: {
  companyId: number;
  children: React.ReactNode;
}) => {
  const [summary, setSummary] = React.useState<CompanyOperatorSummary | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const requestRef = React.useRef(0);

  const refresh = React.useCallback(async () => {
    const request = ++requestRef.current;
    setLoading(true);
    setError(null);
    try {
      const result = await getCompanyOperatorSummary(companyId);
      if (request !== requestRef.current) return;
      if (result.success && result.data) {
        setSummary(result.data);
      } else {
        setSummary(null);
        setError(
          getErrorMessageByType(
            classifyClientError(null, undefined, result.errorType),
            result.error || 'No se pudo cargar la empresa',
          ),
        );
      }
    } catch (loadError) {
      if (request !== requestRef.current) return;
      setError(
        getErrorMessageByType(
          classifyClientError(loadError),
          'No se pudo cargar la empresa',
        ),
      );
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  }, [companyId]);

  React.useEffect(() => {
    setSummary(null);
    void refresh();
  }, [refresh]);

  const value = React.useMemo(
    () => ({ companyId, summary, loading, error, refresh }),
    [companyId, summary, loading, error, refresh],
  );

  return (
    <OperatorCompanyContext.Provider value={value}>
      {children}
    </OperatorCompanyContext.Provider>
  );
};

export const useOperatorCompany = (): OperatorCompanyContextValue => {
  const value = React.useContext(OperatorCompanyContext);
  if (!value) {
    throw new Error('useOperatorCompany must be used inside OperatorCompanyProvider');
  }
  return value;
};
