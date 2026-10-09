import {
  fetchAndDeliverTicketInvoice,
  fetchTicketInvoiceFile,
  shareTicketInvoiceFile,
} from '@/lib/ticket-invoice-download';
import { buildTicketInvoicePreviewUrl } from '@/lib/ticket-invoice-url';

describe('fetchAndDeliverTicketInvoice', () => {
  const clickMock = jest.fn();

  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      blob: async () => new Blob(['pdf'], { type: 'application/pdf' }),
    }) as jest.Mock;
    global.URL.createObjectURL = jest.fn(() => 'blob:invoice');
    global.URL.revokeObjectURL = jest.fn();
    jest
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(clickMock);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    Object.defineProperty(navigator, 'canShare', {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: undefined,
    });
  });

  it('shares the PDF file when Web Share accepts files', async () => {
    const share = jest.fn().mockResolvedValue(undefined);
    const canShare = jest.fn().mockReturnValue(true);
    Object.defineProperty(navigator, 'canShare', {
      configurable: true,
      value: canShare,
    });
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: share,
    });

    const result = await fetchAndDeliverTicketInvoice({
      ticketId: 7,
      companyId: 3,
      downloadFileName: 'ticket-7.pdf',
    });

    expect(result).toBe('shared');
    expect(global.fetch).toHaveBeenCalledWith('/api/tickets/7/invoice?company_id=3', {
      cache: 'no-store',
      signal: expect.any(AbortSignal),
    });
    expect(canShare).toHaveBeenCalledWith({
      files: [expect.any(File)],
    });
    expect(share).toHaveBeenCalledWith({
      files: [expect.any(File)],
      title: 'Compartir PDF',
      text: 'ticket-7.pdf',
    });
    expect(clickMock).not.toHaveBeenCalled();
  });

  it('downloads the PDF when file sharing is unavailable', async () => {
    Object.defineProperty(navigator, 'canShare', {
      configurable: true,
      value: jest.fn().mockReturnValue(false),
    });

    const result = await fetchAndDeliverTicketInvoice({
      ticketId: 7,
      downloadFileName: 'ticket-7.pdf',
    });

    expect(result).toBe('downloaded');
    expect(global.URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(clickMock).toHaveBeenCalledTimes(1);
    expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:invoice');
  });

  it('returns dismissed when the user cancels the share sheet', async () => {
    Object.defineProperty(navigator, 'canShare', {
      configurable: true,
      value: jest.fn().mockReturnValue(true),
    });
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: jest
        .fn()
        .mockRejectedValue(new DOMException('Share cancelled', 'AbortError')),
    });

    const result = await fetchAndDeliverTicketInvoice({
      ticketId: 7,
      downloadFileName: 'ticket-7.pdf',
    });

    expect(result).toBe('dismissed');
    expect(clickMock).not.toHaveBeenCalled();
  });

  it('downloads without offering the share sheet in download mode', async () => {
    const share = jest.fn();
    Object.defineProperty(navigator, 'canShare', {
      configurable: true,
      value: jest.fn().mockReturnValue(true),
    });
    Object.defineProperty(navigator, 'share', { configurable: true, value: share });

    const result = await fetchAndDeliverTicketInvoice({
      ticketId: 7,
      downloadFileName: 'ticket-7.pdf',
      mode: 'download',
    });

    expect(result).toBe('downloaded');
    expect(share).not.toHaveBeenCalled();
    expect(clickMock).toHaveBeenCalled();
  });

  it('fetches the PDF as a named File', async () => {
    const file = await fetchTicketInvoiceFile({
      ticketId: 9,
      companyId: 3,
      downloadFileName: 'recibo-9.pdf',
    });
    expect(file.name).toBe('recibo-9.pdf');
    expect(file.type).toBe('application/pdf');
  });

  it('reports needs-gesture when the browser blocks a late share', async () => {
    Object.defineProperty(navigator, 'canShare', {
      configurable: true,
      value: jest.fn().mockReturnValue(true),
    });
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: jest
        .fn()
        .mockRejectedValue(new DOMException('no activation', 'NotAllowedError')),
    });
    const file = new File(['pdf'], 'r.pdf', { type: 'application/pdf' });

    await expect(shareTicketInvoiceFile(file, { title: 'Recibo' })).resolves.toBe(
      'needs-gesture',
    );
  });

  it('reports unsupported without Web Share for files', async () => {
    const file = new File(['pdf'], 'r.pdf', { type: 'application/pdf' });
    await expect(shareTicketInvoiceFile(file, { title: 'Recibo' })).resolves.toBe(
      'unsupported',
    );
  });

  it('builds an inline preview URL', () => {
    expect(buildTicketInvoicePreviewUrl(7, 3)).toBe(
      '/api/tickets/7/invoice?disposition=inline&company_id=3',
    );
  });
});
