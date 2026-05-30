import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { PDFDownloadButton } from '@/components/pdf-download-button';

jest.mock('sonner', () => ({
  toast: {
    error: jest.fn(),
    success: jest.fn(),
  },
}));

describe('PDFDownloadButton', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('aborts the PDF request and clears loading state after the timeout', async () => {
    const fetchMock = jest.fn(
      (_url: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'));
          });
        }),
    );
    global.fetch = fetchMock;

    render(
      <PDFDownloadButton ticketId={123n} downloadFileName="ticket-123.pdf" />,
    );

    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const button = screen.getByRole('button', { name: /Descargar PDF/i });

    await user.click(button);

    expect(button).toBeDisabled();
    expect(fetchMock).toHaveBeenCalledWith('/api/tickets/123/invoice', {
      cache: 'no-store',
      signal: expect.any(AbortSignal),
    });

    jest.advanceTimersByTime(60_000);

    await waitFor(() => {
      expect(button).toBeEnabled();
    });
    expect(toast.error).toHaveBeenCalledWith(
      'No se pudo generar el PDF. Código: PDF001',
    );
  });
});
