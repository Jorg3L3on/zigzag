/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';

import { DocumentPdfAside } from '@/components/documents/document-pdf-aside';

let mockDesktop = true;
let mockPdfViewer = true;
let mockCan = (_key: string) => true;

jest.mock('@/hooks/use-desktop', () => ({ useIsDesktop: () => mockDesktop }));
jest.mock('@/components/tickets/review/document-review-parts', () => ({
  usePdfViewerEnabled: () => mockPdfViewer,
}));
jest.mock('@/hooks/use-permissions', () => ({
  usePermissions: () => ({ can: (key: string) => mockCan(key) }),
}));
jest.mock('@/contexts/company-context', () => ({
  useCompany: () => ({ selectedCompany: { id: 4, name: 'Demo' } }),
}));
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
jest.mock('@/lib/ticket-invoice-download', () => ({
  fetchAndDeliverTicketInvoice: jest.fn(),
}));

const renderAside = () =>
  render(
    <DocumentPdfAside
      ticketId="77"
      kind="presupuesto"
      viewerHref="/presupuestos/77/pdf"
      downloadFileName="p.pdf"
      version="1"
      actions={<button type="button">Editar</button>}
    />,
  );

describe('DocumentPdfAside (ZIG-I24-3)', () => {
  beforeEach(() => {
    mockDesktop = true;
    mockPdfViewer = true;
    mockCan = () => true;
  });

  it('shows the PDF with Abrir, Descargar and the actions on desktop', () => {
    renderAside();
    expect(screen.getByRole('heading', { name: 'PDF del presupuesto' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Abrir' })).toHaveAttribute('href', '/presupuestos/77/pdf');
    expect(screen.getByRole('button', { name: 'Descargar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Editar' })).toBeInTheDocument();
    expect(screen.getByTestId('pdf-viewer-embed')).toHaveAttribute(
      'src',
      '/api/tickets/77/invoice?disposition=inline&company_id=4',
    );
  });

  it('renders nothing below 1024px, so phones never load the PDF', () => {
    mockDesktop = false;
    const { container } = renderAside();
    expect(container).toBeEmptyDOMElement();
  });

  it('keeps Abrir and Descargar where the browser cannot show a PDF inline', () => {
    mockPdfViewer = false;
    renderAside();
    expect(screen.queryByTestId('pdf-viewer-embed')).toBeNull();
    expect(screen.getByTestId('document-pdf-aside-fallback')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Abrir' })).toBeInTheDocument();
  });

  it('shows only the actions without permission to read the PDF', () => {
    mockCan = () => false;
    renderAside();
    expect(screen.queryByRole('link', { name: 'Abrir' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Editar' })).toBeInTheDocument();
  });
});
