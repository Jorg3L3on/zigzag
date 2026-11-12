import { contentDisposition } from './content-disposition';

describe('contentDisposition', () => {
  it('keeps ñ and accents in filename* and gives an ASCII fallback', () => {
    const header = contentDisposition('attachment', 'Recibo R-0043 · Peña.pdf');
    expect(header).toContain('filename="Recibo R-0043 _ Pena.pdf"');
    expect(header).toContain("filename*=UTF-8''Recibo%20R-0043%20%C2%B7%20Pe%C3%B1a.pdf");
  });
});
