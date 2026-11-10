import { render, screen } from '@testing-library/react';
import { BreadcrumbLink } from '@/components/ui/breadcrumb';

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} data-next-link="true" {...props}>
      {children}
    </a>
  ),
}));

describe('BreadcrumbLink (ZIG-I37-6)', () => {
  it('navigates with next/link when given an href', () => {
    render(<BreadcrumbLink href="/tickets">Tickets</BreadcrumbLink>);
    const link = screen.getByRole('link', { name: 'Tickets' });
    expect(link).toHaveAttribute('href', '/tickets');
    expect(link).toHaveAttribute('data-next-link', 'true');
  });

  it('still supports asChild', () => {
    render(
      <BreadcrumbLink asChild>
        <a href="/x">X</a>
      </BreadcrumbLink>,
    );
    const link = screen.getByRole('link', { name: 'X' });
    expect(link).not.toHaveAttribute('data-next-link');
    expect(link.className).toContain('inline-flex');
  });
});
