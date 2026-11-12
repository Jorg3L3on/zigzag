/**
 * @jest-environment jsdom
 */
import type { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { NavHelpLink } from '@/components/nav-help-link';
import { NavUser } from '@/components/nav-user';

let isSystem = false;

jest.mock('next-auth/react', () => ({
  useSession: () => ({
    data: { user: { name: 'Ana', email: 'ana@example.com', company_is_system: isSystem } },
  }),
  signOut: jest.fn(),
}));

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@/lib/push-client', () => ({ disablePushOnThisDevice: jest.fn() }));
jest.mock('@/lib/field-jobs', () => ({ clearFieldJobsOnLogout: jest.fn() }));

jest.mock('@/components/ui/sidebar', () => ({
  SidebarMenu: ({ children }: { children: ReactNode }) => <ul>{children}</ul>,
  SidebarMenuItem: ({ children }: { children: ReactNode }) => <li>{children}</li>,
  SidebarMenuButton: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  useSidebar: () => ({ isMobile: false, setOpenMobile: jest.fn() }),
}));

// Render the avatar menu open and flat so its items can be clicked directly.
jest.mock('@/components/ui/dropdown-menu', () => {
  const Pass = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return {
    DropdownMenu: Pass,
    DropdownMenuTrigger: Pass,
    DropdownMenuContent: Pass,
    DropdownMenuGroup: Pass,
    DropdownMenuLabel: Pass,
    DropdownMenuSeparator: () => <hr />,
    DropdownMenuItem: ({ children, onClick }: { children: ReactNode; onClick?: () => void }) => (
      <button type="button" role="menuitem" onClick={onClick}>
        {children}
      </button>
    ),
  };
});

describe('in-app help opens the /ayuda help centre (ZIG-I40-6)', () => {
  const open = jest.spyOn(window, 'open').mockImplementation(() => null);

  beforeEach(() => {
    open.mockClear();
    isSystem = false;
  });

  it('¿Cómo se usa? in the Más sheet links to /ayuda in a new tab', () => {
    render(<NavHelpLink />);
    const link = screen.getByRole('link', { name: '¿Cómo se usa?' });
    expect(link).toHaveAttribute('href', '/ayuda');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('¿Cómo se usa? in the avatar menu opens /ayuda for tenant users', () => {
    render(<NavUser />);
    fireEvent.click(screen.getByRole('menuitem', { name: '¿Cómo se usa?' }));
    expect(open).toHaveBeenCalledWith('/ayuda', '_blank', 'noopener,noreferrer');
  });

  it('system users get one Guías item to /ayuda, with no executive summary', () => {
    isSystem = true;
    render(<NavUser />);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Guías' }));
    expect(open).toHaveBeenCalledWith('/ayuda', '_blank', 'noopener,noreferrer');
    expect(screen.queryByText(/Resumen ejecutivo/)).not.toBeInTheDocument();
  });
});
