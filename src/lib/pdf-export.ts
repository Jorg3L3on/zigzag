type JsPdfConstructor = new (options: {
  orientation: 'portrait';
  unit: 'mm';
  format: 'a4';
  compress: boolean;
}) => {
  internal: { pageSize: { getWidth: () => number; getHeight: () => number } };
  addPage: () => void;
  addImage: (
    imageData: string,
    format: 'PNG',
    x: number,
    y: number,
    width: number,
    height: number,
  ) => void;
  save: (filename: string) => void;
  output: (type: 'blob') => Blob;
};

export async function renderElementToPdfBlob(element: HTMLElement): Promise<Blob> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas-pro'),
    import('jspdf'),
  ]);

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
    scrollX: 0,
    scrollY: 0,
  });

  const pdf = new (jsPDF as JsPdfConstructor)({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 8;
  const contentWidth = pageWidth - margin * 2;
  const contentHeight = pageHeight - margin * 2;
  const imageData = canvas.toDataURL('image/png');
  const imageHeight = (canvas.height * contentWidth) / canvas.width;

  if (imageHeight <= contentHeight) {
    pdf.addImage(imageData, 'PNG', margin, margin, contentWidth, imageHeight);
    return pdf.output('blob');
  }

  const canvasPageHeight = Math.floor((contentHeight * canvas.width) / contentWidth);
  let renderedHeight = 0;
  let isFirstPage = true;

  while (renderedHeight < canvas.height) {
    const pageCanvas = document.createElement('canvas');
    pageCanvas.width = canvas.width;
    pageCanvas.height = Math.min(canvasPageHeight, canvas.height - renderedHeight);

    const context = pageCanvas.getContext('2d');
    if (!context) {
      throw new Error('No se pudo inicializar el contexto del canvas para PDF.');
    }

    context.drawImage(
      canvas,
      0,
      renderedHeight,
      canvas.width,
      pageCanvas.height,
      0,
      0,
      canvas.width,
      pageCanvas.height,
    );

    const pageImage = pageCanvas.toDataURL('image/png');
    const pageImageHeight = (pageCanvas.height * contentWidth) / pageCanvas.width;

    if (!isFirstPage) {
      pdf.addPage();
    }

    pdf.addImage(pageImage, 'PNG', margin, margin, contentWidth, pageImageHeight);
    renderedHeight += pageCanvas.height;
    isFirstPage = false;
  }

  return pdf.output('blob');
}
