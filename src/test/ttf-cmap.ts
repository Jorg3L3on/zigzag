/**
 * Code points a TrueType font maps to a glyph, read from its cmap (formats 4
 * and 12). Test-only: proves pdf-text-support.ts only allows what the
 * embedded fonts can draw.
 */
import { readFileSync } from 'node:fs';

export const ttfCodePoints = (path: string): Set<number> => {
  const buffer = readFileSync(path);
  const tableCount = buffer.readUInt16BE(4);
  let cmapOffset = 0;
  for (let i = 0; i < tableCount; i += 1) {
    const entry = 12 + i * 16;
    if (buffer.toString('ascii', entry, entry + 4) === 'cmap') {
      cmapOffset = buffer.readUInt32BE(entry + 8);
    }
  }
  const codePoints = new Set<number>();
  const subtables = buffer.readUInt16BE(cmapOffset + 2);
  for (let i = 0; i < subtables; i += 1) {
    const offset = cmapOffset + buffer.readUInt32BE(cmapOffset + 8 + i * 8);
    const format = buffer.readUInt16BE(offset);
    if (format === 4) {
      const segmentsX2 = buffer.readUInt16BE(offset + 6);
      const endCodes = offset + 14;
      const startCodes = endCodes + segmentsX2 + 2;
      const deltas = startCodes + segmentsX2;
      const rangeOffsets = deltas + segmentsX2;
      for (let segment = 0; segment < segmentsX2 / 2; segment += 1) {
        const end = buffer.readUInt16BE(endCodes + segment * 2);
        const start = buffer.readUInt16BE(startCodes + segment * 2);
        const delta = buffer.readInt16BE(deltas + segment * 2);
        const rangeOffset = buffer.readUInt16BE(rangeOffsets + segment * 2);
        for (let code = start; code <= end && code !== 0xffff; code += 1) {
          let glyph: number;
          if (rangeOffset === 0) {
            glyph = (code + delta) & 0xffff;
          } else {
            glyph = buffer.readUInt16BE(
              rangeOffsets + segment * 2 + rangeOffset + (code - start) * 2,
            );
            if (glyph) glyph = (glyph + delta) & 0xffff;
          }
          if (glyph) codePoints.add(code);
        }
      }
    } else if (format === 12) {
      const groups = buffer.readUInt32BE(offset + 12);
      for (let group = 0; group < groups; group += 1) {
        const start = buffer.readUInt32BE(offset + 16 + group * 12);
        const end = buffer.readUInt32BE(offset + 20 + group * 12);
        for (let code = start; code <= end; code += 1) codePoints.add(code);
      }
    }
  }
  return codePoints;
};
