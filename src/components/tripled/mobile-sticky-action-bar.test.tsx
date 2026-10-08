/**
 * @jest-environment jsdom
 */
import { act } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';

import { TripledMobileStickyActionBar } from '@/components/tripled/mobile-first';
import { MobileChromeProvider } from '@/contexts/mobile-chrome-context';

const tree = (
  <MobileChromeProvider>
    <main>
      <p>Contenido</p>
      <TripledMobileStickyActionBar>
        <button type="button">Guardar ticket</button>
      </TripledMobileStickyActionBar>
    </main>
  </MobileChromeProvider>
);

describe('TripledMobileStickyActionBar', () => {
  it('hydrates without a mismatch and portals the bar after mount', async () => {
    const container = document.createElement('div');
    container.innerHTML = renderToString(tree);
    document.body.appendChild(container);

    const onRecoverableError = jest.fn();
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    let root: ReturnType<typeof hydrateRoot> | undefined;
    await act(async () => {
      root = hydrateRoot(container, tree, { onRecoverableError });
    });

    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(
      consoleError.mock.calls.filter((call) =>
        String(call[0]).toLowerCase().includes('hydrat'),
      ),
    ).toEqual([]);
    expect(
      document.body.querySelector('[data-testid="mobile-sticky-action-bar"]'),
    ).not.toBeNull();

    await act(async () => root?.unmount());
    consoleError.mockRestore();
    container.remove();
  });
});
