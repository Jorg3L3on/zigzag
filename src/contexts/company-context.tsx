'use client';

import * as React from 'react';
import { CompanyBrandAvatar } from '@/components/companies/company-brand-avatar';
import { resolveCompanyLogoUrl } from '@/lib/company-logo-storage';

interface Company {
  id: number;
  name: string;
  logo: React.ElementType;
  logoUrl: string | null;
  plan: string;
  is_system: boolean;
}

interface StoredCompany {
  id: number;
  name: string;
  logoUrl: string | null;
  plan: string;
  is_system: boolean;
}

interface CompanyContextType {
  selectedCompany: Company | null;
  setSelectedCompany: (company: Company | null) => void;
}

const CompanyContext = React.createContext<CompanyContextType | undefined>(
  undefined,
);

const companyFromStored = (storedCompany: StoredCompany): Company => ({
  ...storedCompany,
  logo: () => (
    <CompanyBrandAvatar
      name={storedCompany.name}
      logoUrl={storedCompany.logoUrl}
    />
  ),
});

const companyToStored = (company: Company): StoredCompany => ({
  id: company.id,
  name: company.name,
  logoUrl: resolveCompanyLogoUrl(company.logoUrl),
  plan: company.plan,
  is_system: company.is_system,
});

export function CompanyProvider({ children }: { children: React.ReactNode }) {
  const [selectedCompany, setSelectedCompany] = React.useState<Company | null>(
    () => {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('selectedCompany');
        if (saved) {
          const storedCompany = JSON.parse(saved) as StoredCompany;
          return companyFromStored(storedCompany);
        }
      }
      return null;
    },
  );

  const handleSetSelectedCompany = React.useCallback(
    (company: Company | null) => {
      setSelectedCompany(company);
      if (company) {
        localStorage.setItem(
          'selectedCompany',
          JSON.stringify(companyToStored(company)),
        );
      } else {
        localStorage.removeItem('selectedCompany');
      }
    },
    [],
  );

  return (
    <CompanyContext.Provider
      value={{ selectedCompany, setSelectedCompany: handleSetSelectedCompany }}
    >
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const context = React.useContext(CompanyContext);
  if (context === undefined) {
    throw new Error('useCompany must be used within a CompanyProvider');
  }
  return context;
}
