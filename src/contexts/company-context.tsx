'use client';

import * as React from 'react';
import { CompanyBrandAvatar } from '@/components/companies/company-brand-avatar';
import { resolveCompanyLogoUrl } from '@/lib/company-logo-storage';
import {
  parseSelectedCompanyJson,
  SELECTED_COMPANY_STORAGE_KEY,
  writeSelectedCompanyCookie,
  type StoredSelectedCompany,
} from '@/lib/selected-company-cookie';

interface Company {
  id: number;
  name: string;
  logo: React.ElementType;
  logoUrl: string | null;
  plan: string;
  is_system: boolean;
}

interface CompanyContextType {
  selectedCompany: Company | null;
  setSelectedCompany: (company: Company | null) => void;
  /**
   * False until the provider has restored the saved choice (cookie on the
   * server, or the legacy localStorage value after mount). Reconcilers such
   * as the team switcher must wait for it, or they would replace a choice
   * that simply has not been read yet (ZIG-I37-6).
   */
  selectionRestored: boolean;
}

const CompanyContext = React.createContext<CompanyContextType | undefined>(
  undefined,
);

const companyFromStored = (storedCompany: StoredSelectedCompany): Company => ({
  ...storedCompany,
  logo: () => (
    <CompanyBrandAvatar
      name={storedCompany.name}
      logoUrl={storedCompany.logoUrl}
    />
  ),
});

const companyToStored = (company: Company): StoredSelectedCompany => ({
  id: company.id,
  name: company.name,
  logoUrl: resolveCompanyLogoUrl(company.logoUrl),
  plan: company.plan,
  is_system: company.is_system,
});

const writeLocalStorage = (stored: StoredSelectedCompany | null) => {
  try {
    if (stored) {
      localStorage.setItem(SELECTED_COMPANY_STORAGE_KEY, JSON.stringify(stored));
    } else {
      localStorage.removeItem(SELECTED_COMPANY_STORAGE_KEY);
    }
  } catch {
    // Storage can be unavailable (private mode, quota); the cookie still holds it.
  }
};

const readLocalStorage = (): StoredSelectedCompany | null => {
  try {
    return parseSelectedCompanyJson(
      localStorage.getItem(SELECTED_COMPANY_STORAGE_KEY),
    );
  } catch {
    return null;
  }
};

/**
 * `initialCompany` comes from the `zigzag_selected_company` cookie, parsed in
 * the root layout, so the server and the first client render agree
 * (ZIG-I37-5). Never read localStorage during render: that is what made the
 * server paint «Selecciona una empresa» and the client paint the list.
 */
export function CompanyProvider({
  children,
  initialCompany = null,
}: {
  children: React.ReactNode;
  initialCompany?: StoredSelectedCompany | null;
}) {
  const [selectedCompany, setSelectedCompany] = React.useState<Company | null>(
    () => (initialCompany ? companyFromStored(initialCompany) : null),
  );
  const [selectionRestored, setSelectionRestored] = React.useState(
    initialCompany != null,
  );
  // Set once anything chooses a company, so the mount sync never undoes it
  // (children's effects run before this provider's).
  const changedRef = React.useRef(false);

  // One-time sync after hydration. With a cookie, keep localStorage in step.
  // Without one (sessions from before the cookie), adopt the localStorage
  // value and write the cookie, so the next load is seeded by the server.
  React.useEffect(() => {
    if (changedRef.current) {
      setSelectionRestored(true);
      return;
    }
    if (initialCompany) {
      writeLocalStorage(initialCompany);
      return;
    }
    const stored = readLocalStorage();
    setSelectionRestored(true);
    if (!stored) {
      return;
    }
    writeSelectedCompanyCookie(stored);
    setSelectedCompany((prev) => prev ?? companyFromStored(stored));
    // Mount only: later changes go through handleSetSelectedCompany.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSetSelectedCompany = React.useCallback(
    (company: Company | null) => {
      changedRef.current = true;
      setSelectedCompany(company);
      const stored = company ? companyToStored(company) : null;
      writeLocalStorage(stored);
      writeSelectedCompanyCookie(stored);
    },
    [],
  );

  const value = React.useMemo(
    () => ({
      selectedCompany,
      setSelectedCompany: handleSetSelectedCompany,
      selectionRestored,
    }),
    [selectedCompany, handleSetSelectedCompany, selectionRestored],
  );

  return (
    <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>
  );
}

export function useCompany() {
  const context = React.useContext(CompanyContext);
  if (context === undefined) {
    throw new Error('useCompany must be used within a CompanyProvider');
  }
  return context;
}
