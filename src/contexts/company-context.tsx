'use client';

import * as React from 'react';
import { GalleryVerticalEnd } from 'lucide-react';
import Image from 'next/image';

interface Company {
  id: number;
  name: string;
  logo: React.ElementType;
  plan: string;
  is_system: boolean;
}

interface StoredCompany {
  id: number;
  name: string;
  logo: string | null;
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

export function CompanyProvider({ children }: { children: React.ReactNode }) {
  const [selectedCompany, setSelectedCompany] = React.useState<Company | null>(
    () => {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('selectedCompany');
        if (saved) {
          const storedCompany = JSON.parse(saved) as StoredCompany;
          return {
            ...storedCompany,
            logo:
              typeof storedCompany.logo === 'string' &&
              storedCompany.logo.length > 0
                ? () => (
                    <Image
                      src={storedCompany.logo!}
                      alt={storedCompany.name}
                      width={16}
                      height={16}
                      className="size-4"
                    />
                  )
                : GalleryVerticalEnd,
          };
        }
      }
      return null;
    },
  );

  const handleSetSelectedCompany = React.useCallback(
    (company: Company | null) => {
      setSelectedCompany(company);
      if (company) {
        // Store only the serializable parts
        const storedCompany: StoredCompany = {
          id: company.id,
          name: company.name,
          logo: typeof company.logo === 'function' ? null : company.logo,
          plan: company.plan,
          is_system: company.is_system,
        };
        localStorage.setItem('selectedCompany', JSON.stringify(storedCompany));
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
