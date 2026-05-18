import { focusInitialOverlayTarget } from '@/lib/overlay-focus';

describe('focusInitialOverlayTarget', () => {
  it('focuses element marked with data-initial-focus', () => {
    const container = document.createElement('motion.div');
    const title = document.createElement('h2');
    title.setAttribute('data-initial-focus', '');
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Close';
    button.setAttribute('data-overlay-close', '');
    container.append(title, button);

    const focusSpy = jest.spyOn(title, 'focus');
    const event = new Event('focusin', { cancelable: true });

    focusInitialOverlayTarget(event, container);

    expect(event.defaultPrevented).toBe(true);
    expect(focusSpy).toHaveBeenCalled();
    expect(title.tabIndex).toBe(-1);
  });

  it('skips overlay close button and focuses first actionable control', () => {
    const container = document.createElement('motion.div');
    const close = document.createElement('button');
    close.type = 'button';
    close.setAttribute('data-overlay-close', '');
    const field = document.createElement('input');
    container.append(close, field);

    const focusSpy = jest.spyOn(field, 'focus');
    const event = new Event('focusin', { cancelable: true });

    focusInitialOverlayTarget(event, container);

    expect(focusSpy).toHaveBeenCalled();
  });
});
