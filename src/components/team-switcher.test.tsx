import { render, screen } from '@testing-library/react';
import { TeamSwitcher } from '@/components/team-switcher';
import { CompanyProvider } from '@/contexts/company-context';
import {
  SELECTED_COMPANY_COOKIE_NAME,
  SELECTED_COMPANY_STORAGE_KEY,
} from '@/lib/selected-company-cookie';

jest.mock('next-auth/react', () => ({
  useSession: () => ({
    data: { user: { company_id: 1, company_is_system: true } },
  }),
}));

jest.mock('@/components/ui/sidebar', () => ({
  SidebarMenu: ({ children }: { children: React.ReactNode }) => <ul>{children}</ul>,
  SidebarMenuItem: ({ children }: { children: React.ReactNode }) => <li>{children}</li>,
  SidebarMenuButton: ({ children }: { children: React.ReactNode }) => (
    <button type="button">{children}</button>
  ),
  useSidebar: () => ({ isMobile: false }),
}));

const asTeam = (id: number, name: string, is_system = false) => ({
  id,
  name,
  logo: () => null,
  logoUrl: null,
  plan: 'Enterprise',
  is_system,
});

const zigzag = asTeam(1, 'ZigZag', true);
const chano = asTeam(7, 'SOLUCIONES CHANO');
const chanoStored = { id: 7, name: 'SOLUCIONES CHANO', logoUrl: null, plan: 'Enterprise', is_system: false };

const storedId = () =>
  JSON.parse(localStorage.getItem(SELECTED_COMPANY_STORAGE_KEY) ?? 'null')?.id ?? null;

describe('TeamSwitcher on a full load (ZIG-I37-6)', () => {
  beforeEach(() => {
    localStorage.clear();
    document.cookie = `${SELECTED_COMPANY_COOKIE_NAME}=; path=/; max-age=0`;
  });

  it('keeps the chosen company while only the session seed is known, and after the list loads', () => {
    const { rerender } = render(
      <CompanyProvider initialCompany={chanoStored}>
        <TeamSwitcher teams={[]} teamsAuthoritative={false} />
      </CompanyProvider>,
    );
    // Seeded by the cookie: shows the choice before any team is known.
    expect(screen.getByText('SOLUCIONES CHANO')).toBeInTheDocument();

    rerender(
      <CompanyProvider initialCompany={chanoStored}>
        <TeamSwitcher teams={[zigzag]} teamsAuthoritative={false} />
      </CompanyProvider>,
    );
    expect(screen.getByText('SOLUCIONES CHANO')).toBeInTheDocument();
    expect(screen.queryByText('ZigZag')).not.toBeInTheDocument();
    expect(storedId()).toBe(7);

    rerender(
      <CompanyProvider initialCompany={chanoStored}>
        <TeamSwitcher teams={[zigzag, chano]} teamsAuthoritative />
      </CompanyProvider>,
    );
    expect(screen.getByText('SOLUCIONES CHANO')).toBeInTheDocument();
    expect(storedId()).toBe(7);
  });

  it('migrates a localStorage-only choice without flipping to ZigZag', () => {
    localStorage.setItem(SELECTED_COMPANY_STORAGE_KEY, JSON.stringify(chanoStored));
    render(
      <CompanyProvider>
        <TeamSwitcher teams={[zigzag]} teamsAuthoritative={false} />
      </CompanyProvider>,
    );
    expect(screen.getByText('SOLUCIONES CHANO')).toBeInTheDocument();
    expect(storedId()).toBe(7);
    expect(document.cookie).toContain(`${SELECTED_COMPANY_COOKIE_NAME}=`);
  });

  it('falls back to the session company when the real list lacks the choice', () => {
    render(
      <CompanyProvider initialCompany={chanoStored}>
        <TeamSwitcher teams={[zigzag]} teamsAuthoritative />
      </CompanyProvider>,
    );
    expect(screen.getByText('ZigZag')).toBeInTheDocument();
    expect(storedId()).toBe(1);
  });
});
