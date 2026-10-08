/**
 * @jest-environment jsdom
 */
import { act, fireEvent, render, screen } from '@testing-library/react';

let mockReduceMotion = false;

jest.mock('framer-motion', () => {
  const actual = jest.requireActual('framer-motion');
  return {
    ...actual,
    useReducedMotion: () => mockReduceMotion,
  };
});

import {
  ActionSwap,
  BlurFade,
  BottomSheet,
  NumberTicker,
  resolveSnapAfterDrag,
} from '@/components/motion';

describe('motion primitives', () => {
  beforeEach(() => {
    mockReduceMotion = false;
    jest.useRealTimers();
  });

  describe('BlurFade', () => {
    it('animates in from a blurred, offset state', () => {
      render(<BlurFade data-testid="fade">Hola</BlurFade>);
      const node = screen.getByTestId('fade');
      expect(node).toHaveTextContent('Hola');
      expect(node).toHaveAttribute('data-blur-fade');
    });

    it('renders the final state with reduced motion', () => {
      mockReduceMotion = true;
      render(<BlurFade data-testid="fade">Hola</BlurFade>);
      const node = screen.getByTestId('fade');
      expect(node).not.toHaveAttribute('data-blur-fade');
      expect(node.style.filter).toBe('');
      expect(node.style.opacity).toBe('');
    });
  });

  describe('NumberTicker', () => {
    const money = (value: number) => `$${value.toFixed(2)}`;

    it('shows the value immediately on mount', () => {
      render(<NumberTicker value={12600} format={money} data-testid="n" />);
      expect(screen.getByTestId('n')).toHaveTextContent('$12600.00');
    });

    it('counts to a new value and lands exactly on it', async () => {
      const { rerender } = render(
        <NumberTicker value={0} format={money} duration={0.05} data-testid="n" />,
      );
      rerender(
        <NumberTicker value={4200} format={money} duration={0.05} data-testid="n" />,
      );
      expect(screen.getByTestId('n')).toHaveAttribute('data-value', '4200');
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
      });
      expect(screen.getByTestId('n')).toHaveTextContent('$4200.00');
    });

    it('jumps straight to the value with reduced motion', () => {
      mockReduceMotion = true;
      const { rerender } = render(
        <NumberTicker value={1} format={money} data-testid="n" />,
      );
      rerender(<NumberTicker value={99} format={money} data-testid="n" />);
      expect(screen.getByTestId('n')).toHaveTextContent('$99.00');
    });
  });

  describe('ActionSwap', () => {
    it('swaps content by key', async () => {
      const { rerender } = render(
        <ActionSwap swapKey="idle">Guardar</ActionSwap>,
      );
      expect(screen.getByText('Guardar')).toBeTruthy();
      rerender(<ActionSwap swapKey="saving">Guardando…</ActionSwap>);
      expect(screen.getByText('Guardando…')).toBeTruthy();
    });

    it('swaps instantly with reduced motion', () => {
      mockReduceMotion = true;
      const { rerender, container } = render(
        <ActionSwap swapKey="idle">Guardar</ActionSwap>,
      );
      rerender(<ActionSwap swapKey="done">Listo</ActionSwap>);
      expect(screen.queryByText('Guardar')).toBeNull();
      expect(container.querySelector('[data-swap-key="done"]')).not.toBeNull();
    });
  });

  describe('BottomSheet', () => {
    it('renders an accessible dialog with title and content when open', () => {
      render(
        <BottomSheet
          open
          onOpenChange={() => undefined}
          title="Editar línea"
          description="Cantidad y precio"
          data-testid="sheet"
        >
          <input aria-label="Cantidad" />
        </BottomSheet>,
      );
      expect(screen.getByRole('dialog', { name: 'Editar línea' })).toBeTruthy();
      expect(screen.getByLabelText('Cantidad')).toBeTruthy();
    });

    it('closes on Escape', () => {
      const onOpenChange = jest.fn();
      render(
        <BottomSheet open onOpenChange={onOpenChange} title="Editar línea">
          <button type="button">Guardar</button>
        </BottomSheet>,
      );
      fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('renders nothing when closed', () => {
      render(
        <BottomSheet open={false} onOpenChange={() => undefined} title="X">
          contenido
        </BottomSheet>,
      );
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('opens at the initial snap', () => {
      render(
        <BottomSheet
          open
          onOpenChange={() => undefined}
          title="Snap"
          snapPoints={[0.5, 0.9]}
          initialSnap={1}
          data-testid="sheet"
        >
          contenido
        </BottomSheet>,
      );
      expect(screen.getByTestId('sheet')).toHaveAttribute('data-snap-index', '1');
    });
  });

  describe('resolveSnapAfterDrag', () => {
    const base = { snapPoints: [0.5, 0.9], viewport: 1000 };

    it('moves up to the taller snap on an upward drag', () => {
      expect(
        resolveSnapAfterDrag({ ...base, currentIndex: 0, offsetY: -350, velocityY: 0 }),
      ).toBe(1);
    });

    it('settles back to the nearest snap on a small drag', () => {
      expect(
        resolveSnapAfterDrag({ ...base, currentIndex: 1, offsetY: 60, velocityY: 0 }),
      ).toBe(1);
    });

    it('dismisses on a fast downward fling', () => {
      expect(
        resolveSnapAfterDrag({ ...base, currentIndex: 1, offsetY: 40, velocityY: 1200 }),
      ).toBeNull();
    });

    it('dismisses when dragged well below the lowest snap', () => {
      expect(
        resolveSnapAfterDrag({ ...base, currentIndex: 0, offsetY: 200, velocityY: 0 }),
      ).toBeNull();
    });
  });
});
