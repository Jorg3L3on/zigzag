import { act, render, screen } from '@testing-library/react';
import { CompanyProvider, useCompany } from '@/contexts/company-context';
import {
  parseSelectedCompanyCookie,
  SELECTED_COMPANY_COOKIE_NAME,
  SELECTED_COMPANY_STORAGE_KEY,
} from '@/lib/selected-company-cookie';

const chano = {
  id: 7,
  name: 'SOLUCIONES CHANO',
  logoUrl: null,
  plan: 'Enterprise',
  is_system: false,
};
const zigzag = { id: 1, name: 'ZigZag', logoUrl: null, plan: 'Enterprise', is_system: true };

const readCookie = () =>
  parseSelectedCompanyCookie(
    document.cookie
      .split('; ')
      .find((part) => part.startsWith(`${SELECTED_COMPANY_COOKIE_NAME}=`))
      ?.slice(SELECTED_COMPANY_COOKIE_NAME.length + 1),
  );

let api: ReturnType<typeof useCompany>;
let firstRenderName: string | null | undefined;

const onRender = (value: ReturnType<typeof useCompany>) => {
  api = value;
  if (firstRenderName === undefined) {
    firstRenderName = value.selectedCompany?.name ?? null;
  }
};

function Probe() {
  const value = useCompany();
  onRender(value);
  return <span data-testid="company">{value.selectedCompany?.name ?? 'none'}</span>;
}

describe('CompanyProvider', () => {
  beforeEach(() => {
    firstRenderName = undefined;
    localStorage.clear();
    document.cookie = `${SELECTED_COMPANY_COOKIE_NAME}=; path=/; max-age=0`;
  });

  it('starts with initialCompany on the first render', () => {
    render(
      <CompanyProvider initialCompany={chano}>
        <Probe />
      </CompanyProvider>,
    );
    expect(firstRenderName).toBe('SOLUCIONES CHANO');
    expect(JSON.parse(localStorage.getItem(SELECTED_COMPANY_STORAGE_KEY)!)).toEqual(chano);
  });

  it('never reads localStorage during the first render (SSR parity)', () => {
    localStorage.setItem(SELECTED_COMPANY_STORAGE_KEY, JSON.stringify(chano));
    render(
      <CompanyProvider>
        <Probe />
      </CompanyProvider>,
    );
    expect(firstRenderName).toBeNull();
    // Migration: adopted after mount and mirrored into the cookie.
    expect(screen.getByTestId('company')).toHaveTextContent('SOLUCIONES CHANO');
    expect(readCookie()).toEqual(chano);
  });

  it('ignores corrupt localStorage', () => {
    localStorage.setItem(SELECTED_COMPANY_STORAGE_KEY, '{broken');
    render(
      <CompanyProvider>
        <Probe />
      </CompanyProvider>,
    );
    expect(screen.getByTestId('company')).toHaveTextContent('none');
    expect(readCookie()).toBeNull();
  });

  it('writes cookie and localStorage on change, clears both on null', () => {
    render(
      <CompanyProvider initialCompany={chano}>
        <Probe />
      </CompanyProvider>,
    );
    act(() => api.setSelectedCompany({ ...zigzag, logo: () => null }));
    expect(readCookie()).toEqual(zigzag);
    expect(JSON.parse(localStorage.getItem(SELECTED_COMPANY_STORAGE_KEY)!)).toEqual(zigzag);

    act(() => api.setSelectedCompany(null));
    expect(readCookie()).toBeNull();
    expect(localStorage.getItem(SELECTED_COMPANY_STORAGE_KEY)).toBeNull();
    expect(screen.getByTestId('company')).toHaveTextContent('none');
  });
});
