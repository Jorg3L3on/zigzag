/**
 * html2pdf.js options tuned for invoice export (html2canvas → jsPDF).
 * Uses flat margins in mm, explicit white canvas background, and sharper raster scale.
 */
export const createInvoicePdfExportOptions = (filename: string) => ({
  margin: [8, 8, 8, 8],
  filename,
  pagebreak: { mode: ['css', 'legacy'] },
  image: { type: 'jpeg' as const, quality: 0.96 },
  html2canvas: {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
    letterRendering: true,
    scrollX: 0,
    scrollY: 0,
  },
  jsPDF: {
    unit: 'mm' as const,
    format: 'a4' as const,
    orientation: 'portrait' as const,
    compress: true,
  },
});
