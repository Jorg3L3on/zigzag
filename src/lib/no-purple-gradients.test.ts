/**
 * @jest-environment node
 *
 * Guard for decision D4 (ZIG-I2): every button is solid blue via `<Button>`.
 * No hardcoded blue→purple / violet gradients anywhere in src/.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const SRC_DIR = path.join(process.cwd(), 'src');
const SELF = path.relative(process.cwd(), __filename);
const FORBIDDEN = [/\bto-purple-\d/, /\bto-violet-\d/, /\bfrom-blue-600 to-/];
const SCANNED = /\.(tsx?|jsx?|css)$/;

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      return walk(full);
    }
    return SCANNED.test(name) ? [full] : [];
  });

describe('no purple gradients guard', () => {
  it('finds no to-purple- / to-violet- / from-blue-600 to- classes in src/', () => {
    const offenders = walk(SRC_DIR)
      .filter((file) => path.relative(process.cwd(), file) !== SELF)
      .flatMap((file) =>
        readFileSync(file, 'utf8')
          .split('\n')
          .flatMap((line, index) =>
            FORBIDDEN.some((pattern) => pattern.test(line))
              ? [`${path.relative(process.cwd(), file)}:${index + 1}`]
              : [],
          ),
      );

    expect(offenders).toEqual([]);
  });
});
