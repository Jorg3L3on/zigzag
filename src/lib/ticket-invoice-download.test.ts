import { fetchAndDeliverTicketInvoice } from '@/lib/ticket-invoice-download';

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
});
