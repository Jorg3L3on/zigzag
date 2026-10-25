/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react';

import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { isSidebarOpenFromCookie } from '@/lib/sidebar-state';

const renderTrigger = (defaultOpen: boolean) =>
  render(
    <SidebarProvider defaultOpen={defaultOpen}>
      <SidebarTrigger />
    </SidebarProvider>,
  );

describe('SidebarTrigger on desktop (ZIG-I26-3)', () => {
  afterEach(() => {
    document.cookie = 'sidebar_state=; path=/; max-age=0';
  });

  it('says Cerrar menú while open and Abrir menú once folded, and stores the state', () => {
    renderTrigger(true);
    const trigger = screen.getByRole('button', { name: 'Cerrar menú' });

    fireEvent.click(trigger);

    expect(screen.getByRole('button', { name: 'Abrir menú' })).toBe(trigger);
    expect(document.cookie).toContain('sidebar_state=false');
  });

  it('starts folded when the layout read a collapsed cookie', () => {
    renderTrigger(false);
    expect(screen.getByRole('button', { name: 'Abrir menú' })).toBeTruthy();
  });
});

describe('isSidebarOpenFromCookie', () => {
  it('is open unless the cookie says false', () => {
    expect(isSidebarOpenFromCookie(undefined)).toBe(true);
    expect(isSidebarOpenFromCookie('true')).toBe(true);
    expect(isSidebarOpenFromCookie('false')).toBe(false);
  });
});
