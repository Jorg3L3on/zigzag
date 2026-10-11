/**
 * @jest-environment node
 *
 * ZIG-I18-3: the app speaks notebook words, not bank/office words. User-facing
 * strings only (string literals and JSX text); comments and the PDF module
 * (src/lib/receipt-pdf, pinned by ZIG-I11/I15) are exempt.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const SRC_DIR = path.join(process.cwd(), 'src');
const SELF = path.relative(process.cwd(), __filename);
const FORBIDDEN =
  /Saldado|Sin pagos(?! registrados)|Finalizar|Guardar línea|Del catálogo|Antigüedad|Captura rápida|Resumen de tu operación|Subtotal de la línea|Abonar|abonar|Saldar\b/;
const SCANNED = /\.tsx?$/;

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return walk(full);
    return SCANNED.test(name) && !/\.test\./.test(name) ? [full] : [];
  });

describe('notebook words guard', () => {
  it('finds no bank/office wording in user-facing strings', () => {
    const offenders = walk(SRC_DIR)
      .filter((file) => !file.includes(`${path.sep}receipt-pdf${path.sep}`))
      .filter((file) => path.relative(process.cwd(), file) !== SELF)
      .flatMap((file) =>
        readFileSync(file, 'utf8')
          .split('\n')
          .map((text, index) => ({ file, text, line: index + 1 }))
          .filter(({ text }) => !/^\s*(\/\/|\*|\/\*)/.test(text))
          .filter(({ text }) => FORBIDDEN.test(text))
          .map(({ file: f, line, text }) => `${path.relative(process.cwd(), f)}:${line}: ${text.trim()}`),
      );
    expect(offenders).toEqual([]);
  });
});
