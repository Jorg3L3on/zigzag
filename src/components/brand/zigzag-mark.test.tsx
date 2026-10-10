import fs from 'node:fs';
import path from 'node:path';

import { render } from '@testing-library/react';

import { ZigZagMark } from '@/components/brand/zigzag-mark';
import {
  zigzagMarkDataUrl,
  zigzagMarkSvg,
  type ZigZagMarkVariant,
} from '@/components/brand/zigzag-mark-svg';

const brandFile = (name: string) =>
  fs.readFileSync(
    path.join(__dirname, '..', '..', '..', 'assets', 'brand', name),
    'utf8',
  );

describe('zigzagMarkSvg', () => {
  it.each<[ZigZagMarkVariant, string]>([
    ['mark', 'zigzag-mark.svg'],
    ['rounded', 'zigzag-icon-rounded.svg'],
    ['square', 'zigzag-icon-square.svg'],
  ])('%s matches assets/brand/%s', (variant, file) => {
    expect(zigzagMarkSvg(variant)).toBe(brandFile(file).trim());
  });

  it('builds a base64 SVG data URL', () => {
    const url = zigzagMarkDataUrl('rounded');

    expect(url.startsWith('data:image/svg+xml;base64,')).toBe(true);
    expect(atob(url.split(',')[1])).toBe(zigzagMarkSvg('rounded'));
  });
});

describe('ZigZagMark', () => {
  it('gives every instance its own gradient and mask ids', () => {
    const { container } = render(
      <>
        <ZigZagMark />
        <ZigZagMark variant="mark" />
      </>,
    );

    const ids = Array.from(container.querySelectorAll('[id]')).map(
      (node) => node.id,
    );

    expect(ids).toHaveLength(4);
    expect(new Set(ids).size).toBe(4);

    for (const svg of Array.from(container.querySelectorAll('svg'))) {
      const ownIds = Array.from(svg.querySelectorAll('[id]')).map(
        (node) => node.id,
      );
      const refs = Array.from(svg.querySelectorAll('[fill^="url"], [mask]'))
        .flatMap((node) => [
          node.getAttribute('fill'),
          node.getAttribute('mask'),
        ])
        .filter((value): value is string => Boolean(value?.startsWith('url(')))
        .map((value) => value.slice(5, -1));

      expect(refs.length).toBeGreaterThan(0);
      refs.forEach((ref) => expect(ownIds).toContain(ref));
    }
  });

  it('is decorative by default and named when given a title', () => {
    const { getAllByTestId } = render(
      <>
        <ZigZagMark />
        <ZigZagMark title="ZigZag" size={48} />
      </>,
    );
    const [decorative, named] = getAllByTestId('zigzag-mark');

    expect(decorative).toHaveAttribute('aria-hidden', 'true');
    expect(named).toHaveAttribute('role', 'img');
    expect(named).toHaveAttribute('aria-label', 'ZigZag');
    expect(named).toHaveAttribute('width', '48');
  });
});
