/**
 * @jest-environment jsdom
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  DocumentPdfViewer,
  type DocumentPdfViewerProps,
} from '@/components/pdf/document-pdf-viewer';
import { MobileChromeProvider } from '@/contexts/mobile-chrome-context';

const mockFetchFile = jest.fn();
const mockShareFile = jest.fn();
const mockDownloadFile = jest.fn();
let mockCanInvoice = true;

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

jest.mock('@/contexts/company-context', () => ({
  useCompany: () => ({ selectedCompany: { id: 10, name: 'ClimaTotal' } }),
}));

jest.mock('@/hooks/use-permissions', () => ({
  usePermissions: () => ({ can: () => true, loading: false, isSystem: false }),
}));

jest.mock('@/lib/tickets-rbac', () => ({
  canDownloadTicketInvoice: () => mockCanInvoice,
}));

jest.mock('@/lib/ticket-invoice-download', () => ({
  fetchTicketInvoiceFile: (...args: unknown[]) => mockFetchFile(...args),
  shareTicketInvoiceFile: (...args: unknown[]) => mockShareFile(...args),
  downloadTicketInvoiceFile: (...args: unknown[]) => mockDownloadFile(...args),
  fetchAndDeliverTicketInvoice: jest.fn(),
}));

jest.mock('@/components/tripled', () => {
  const actual = jest.requireActual('@/components/tripled');
  return {
    ...actual,
    TripledMobileAppBar: ({
      title,
      subtitle,
      backHref,
      backLabel,
    }: {
      title: string;
      subtitle?: string;
      backHref?: string;
      backLabel?: string;
    }) => (
      <header data-testid="mobile-app-bar">
        <a href={backHref} aria-label={backLabel}>
          back
        </a>
        <p>{title}</p>
        <p>{subtitle}</p>
      </header>
    ),
  };
});

jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn(), message: jest.fn() },
}));

const baseProps: DocumentPdfViewerProps = {
  ticketId: '1069',
  kind: 'presupuesto',
  title: 'Presupuesto #1069',
  subtitle: 'Abierto',
  backHref: '/presupuestos/1069',
  backLabel: 'Volver al presupuesto',
  downloadFileName: 'Cliente_Demo_1069.pdf',
  summary: <div data-testid="presupuesto-summary">Resumen</div>,
  whatsApp: {
    kind: 'presupuesto',
    phone: '9613151559',
    clientName: 'Cliente Demo',
    total: 1000,
    servicesSummary: 'Mantenimiento',
    validUntil: null,
  },
};

const setPdfViewerEnabled = (value: boolean) =>
  Object.defineProperty(navigator, 'pdfViewerEnabled', { configurable: true, value });

const renderViewer = (props: Partial<DocumentPdfViewerProps> = {}) =>
  render(
    <MobileChromeProvider>
      <DocumentPdfViewer {...baseProps} {...props} />
    </MobileChromeProvider>,
  );

const pdfFile = new File(['pdf'], 'Cliente_Demo_1069.pdf', { type: 'application/pdf' });

describe('DocumentPdfViewer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCanInvoice = true;
    mockFetchFile.mockResolvedValue(pdfFile);
    mockShareFile.mockResolvedValue('shared');
  });

  it('keeps the app bar with a back arrow to the detail page', () => {
    setPdfViewerEnabled(true);
    renderViewer();

    expect(screen.getByTestId('mobile-app-bar')).toHaveTextContent('Presupuesto #1069');
    expect(screen.getAllByRole('link', { name: 'Volver al presupuesto' })[0]).toHaveAttribute(
      'href',
      '/presupuestos/1069',
    );
  });

  it('embeds the inline PDF full height where the browser can render it', () => {
    setPdfViewerEnabled(true);
    renderViewer();

    expect(screen.getByTestId('pdf-viewer-embed')).toHaveAttribute(
      'data',
      '/api/tickets/1069/invoice?disposition=inline&company_id=10',
    );
    expect(screen.queryByTestId('pdf-viewer-sticky-actions')).toBeNull();
    expect(screen.getByRole('button', { name: 'Descargar PDF' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Compartir' })).toBeTruthy();
  });

  it('falls back to the summary with Descargar y Compartir and a hint', () => {
    setPdfViewerEnabled(false);
    renderViewer();

    expect(screen.queryByTestId('pdf-viewer-embed')).toBeNull();
    expect(screen.getByTestId('presupuesto-summary')).toBeTruthy();
    expect(screen.getByTestId('pdf-viewer-hint')).toHaveTextContent(
      'Tu navegador no muestra PDF aquí; descárgalo o compártelo.',
    );
    expect(screen.getByTestId('pdf-viewer-sticky-actions')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Descargar PDF' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: 'Compartir' }).length).toBeGreaterThan(0);
  });

  it('shows the summary alone, without embed or actions, when the role cannot download', () => {
    setPdfViewerEnabled(true);
    mockCanInvoice = false;
    renderViewer();

    expect(screen.queryByTestId('pdf-viewer-embed')).toBeNull();
    expect(screen.getByTestId('presupuesto-summary')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Descargar PDF' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Compartir' })).toBeNull();
    expect(screen.queryByTestId('pdf-viewer-hint')).toBeNull();
  });

  it('shares the PDF file through the share sheet', async () => {
    setPdfViewerEnabled(true);
    renderViewer();

    await userEvent.click(screen.getByRole('button', { name: 'Compartir' }));

    await waitFor(() => expect(mockShareFile).toHaveBeenCalledTimes(1));
    expect(mockFetchFile).toHaveBeenCalledWith({
      ticketId: '1069',
      downloadFileName: 'Cliente_Demo_1069.pdf',
      companyId: 10,
    });
    expect(mockShareFile).toHaveBeenCalledWith(
      pdfFile,
      expect.objectContaining({ title: 'Presupuesto #1069' }),
    );
  });

  it('opens WhatsApp with the summary when the share sheet is unsupported', async () => {
    setPdfViewerEnabled(true);
    mockShareFile.mockResolvedValue('unsupported');
    const open = jest.spyOn(window, 'open').mockImplementation(() => null);
    renderViewer();

    await userEvent.click(screen.getByRole('button', { name: 'Compartir' }));

    await waitFor(() => expect(open).toHaveBeenCalledTimes(1));
    expect(String(open.mock.calls[0][0])).toContain('wa.me/');
    expect(mockDownloadFile).not.toHaveBeenCalled();
    open.mockRestore();
  });

  it('downloads the PDF when the share sheet is unsupported and there is no phone', async () => {
    setPdfViewerEnabled(true);
    mockShareFile.mockResolvedValue('unsupported');
    renderViewer({
      whatsApp: { ...(baseProps.whatsApp as object), phone: null } as DocumentPdfViewerProps['whatsApp'],
    });

    await userEvent.click(screen.getByRole('button', { name: 'Compartir' }));

    await waitFor(() => expect(mockDownloadFile).toHaveBeenCalledWith(pdfFile));
  });
});
