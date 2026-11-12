import fs from 'node:fs';
import path from 'node:path';

const css = fs.readFileSync(path.join(__dirname, 'globals.css'), 'utf8');

/** The first block of `selector { … }` custom properties in globals.css. */
const readTokens = (selector: string) => {
  const start = css.indexOf(`${selector} {`);
  const block = css.slice(start, css.indexOf('}', start));
  const tokens = new Map<string, string>();
  for (const match of block.matchAll(/--([\w-]+):\s*([^;]+);/g)) {
    tokens.set(match[1], match[2].trim());
  }
  return tokens;
};

const hslToRgb = (value: string) => {
  const [h, s, l] = value.split(/\s+/).map((part) => parseFloat(part));
  const sat = s / 100;
  const light = l / 100;
  const a = sat * Math.min(light, 1 - light);
  const channel = (n: number) => {
    const k = (n + h / 30) % 12;
    return light - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [channel(0), channel(8), channel(4)];
};

const luminance = (rgb: number[]) => {
  const [r, g, b] = rgb.map((c) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4),
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(hslToRgb(a)), luminance(hslToRgb(b))].sort(
    (x, y) => y - x,
  );
  return (hi + 0.05) / (lo + 0.05);
};

describe('dark theme destructive red (ZIG-I26-1)', () => {
  const dark = readTokens('.dark');
  const token = (name: string) => {
    const value = dark.get(name);
    if (!value) throw new Error(`--${name} missing from .dark`);
    return value;
  };

  it.each(['background', 'card', 'popover', 'accent', 'sidebar-background'])(
    'text-destructive reads on --%s (≥ 4.5:1)',
    (surface) => {
      expect(contrast(token('destructive'), token(surface))).toBeGreaterThanOrEqual(4.5);
    },
  );

  it('the solid destructive button keeps its label readable (≥ 4.5:1)', () => {
    expect(
      contrast(token('destructive-foreground'), token('destructive')),
    ).toBeGreaterThanOrEqual(4.5);
  });
});
