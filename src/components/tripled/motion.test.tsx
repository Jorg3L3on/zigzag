/**
 * @jest-environment jsdom
 */
import { act } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';

import {
  TripledMotionDiv,
  tripledFadeInUp,
  tripledStagger,
} from '@/components/tripled/motion';

// framer-motion reads the setting once, on the first useReducedMotion call, so it is set before any render.
window.matchMedia = jest.fn().mockImplementation((query: string) => ({
  matches: query.includes('prefers-reduced-motion'),
  media: query,
  onchange: null,
  addListener: jest.fn(),
  removeListener: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  dispatchEvent: jest.fn(),
}));

const tree = (
  <TripledMotionDiv
    data-testid="list"
    variants={tripledStagger}
    initial="hidden"
    animate="visible"
  >
    <TripledMotionDiv data-testid="card" variants={tripledFadeInUp}>
      Menú
    </TripledMotionDiv>
  </TripledMotionDiv>
);

const flushFrames = async () => {
  for (let i = 0; i < 5; i += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
  }
};

describe('TripledMotionDiv', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('leaves the SSR hidden state after hydrating with reduced motion on', async () => {
    // The server knows nothing about the user's setting and renders `hidden` inline.
    const html = renderToString(tree);
    expect(html).toContain('opacity:0');

    const container = document.createElement('div');
    container.innerHTML = html;
    document.body.appendChild(container);

    await act(async () => {
      hydrateRoot(container, tree);
    });
    await flushFrames();

    const card = container.querySelector<HTMLElement>('[data-testid="card"]');
    expect(card?.style.opacity).toBe('1');
    expect(card?.style.transform).not.toContain('14px');
  });

  it('makes every variant transition instant in reduced mode', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    const { createRoot } = await import('react-dom/client');
    await act(async () => {
      createRoot(container).render(tree);
    });
    // One short tick is far below the 300 ms fade, so only an instant transition passes.
    await flushFrames();

    const card = container.querySelector<HTMLElement>('[data-testid="card"]');
    expect(card?.style.opacity).toBe('1');
  });
});
