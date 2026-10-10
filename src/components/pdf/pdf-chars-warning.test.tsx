/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';

import { PdfCharsWarning } from '@/components/pdf/pdf-chars-warning';

describe('PdfCharsWarning', () => {
  it('renders nothing for text the PDF can print', () => {
    render(<PdfCharsWarning text="Instalación de minisplit ñ — 12 €" />);
    expect(screen.queryByTestId('pdf-chars-warning')).toBeNull();
  });

  it('lists the characters that will not print', () => {
    render(<PdfCharsWarning text="Urgente 🔥 维修" />);
    expect(screen.getByTestId('pdf-chars-warning')).toHaveTextContent(
      'Estos caracteres no salen en el PDF: 🔥 维 修',
    );
  });

  it('caps the list at six characters', () => {
    render(<PdfCharsWarning text="日本語中文字符" />);
    expect(screen.getByTestId('pdf-chars-warning')).toHaveTextContent('日 本 語 中 文 字 …');
  });
});
