/**
 * Reads the text layer of an uncompressed jsPDF document (render with
 * `compress: false`): one array of text runs per page, in drawing order, with
 * the font each run uses. Only handles what jsPDF writes for embedded TrueType
 * fonts (Identity-H `<hex> Tj` runs mapped through each font's ToUnicode CMap).
 */
export type PdfTextRun = { text: string; font: string; size: number; x: number; y: number };

export type PdfTextPage = {
  width: number;
  height: number;
  runs: PdfTextRun[];
};

const objectBodies = (pdf: string): Map<string, string> => {
  const bodies = new Map<string, string>();
  for (const match of pdf.matchAll(/(\d+) 0 obj([\s\S]*?)endobj/g)) {
    bodies.set(match[1], match[2]);
  }
  return bodies;
};

const streamOf = (body: string): string =>
  body.match(/stream\r?\n([\s\S]*?)\r?\nendstream/)?.[1] ?? '';

const parseCMap = (stream: string): Map<string, string> => {
  const map = new Map<string, string>();
  for (const block of stream.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    for (const pair of block[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g)) {
      const code = pair[1].toLowerCase().padStart(4, '0');
      const units = pair[2].match(/.{4}/g) ?? [];
      map.set(code, String.fromCharCode(...units.map((unit) => parseInt(unit, 16))));
    }
  }
  return map;
};

export const extractPdfText = (bytes: ArrayBuffer | Uint8Array): PdfTextPage[] => {
  const pdf = Buffer.from(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)).toString('latin1');
  const bodies = objectBodies(pdf);

  const resourceFonts = new Map<string, { name: string; cmap: Map<string, string> }>();
  for (const body of bodies.values()) {
    const dict = body.match(/\/Font <<([\s\S]*?)>>/)?.[1];
    if (!dict || body.includes('/Type /Font')) continue;
    for (const entry of dict.matchAll(/\/(F\d+) (\d+) 0 R/g)) {
      const fontBody = bodies.get(entry[2]) ?? '';
      const name = fontBody.match(/\/BaseFont \/([^\s/]+)/)?.[1] ?? entry[1];
      const toUnicode = fontBody.match(/\/ToUnicode (\d+) 0 R/)?.[1];
      const cmap = toUnicode ? parseCMap(streamOf(bodies.get(toUnicode) ?? '')) : new Map();
      resourceFonts.set(entry[1], { name, cmap });
    }
  }

  const pagesId = [...bodies.entries()].find(([, body]) => /\/Type \/Pages\b/.test(body))?.[0];
  const kids = [...(bodies.get(pagesId ?? '')?.match(/\/Kids \[([^\]]*)\]/)?.[1] ?? '').matchAll(/(\d+) 0 R/g)].map(
    (kid) => kid[1],
  );

  return kids.map((pageId) => {
    const page = bodies.get(pageId) ?? '';
    const box = page.match(/\/MediaBox \[([^\]]+)\]/)?.[1].trim().split(/\s+/).map(Number) ?? [0, 0, 0, 0];
    const contentId = page.match(/\/Contents (\d+) 0 R/)?.[1] ?? '';
    const content = streamOf(bodies.get(contentId) ?? '');
    const runs: PdfTextRun[] = [];
    let font = { name: '', cmap: new Map<string, string>() };
    let size = 0;
    let x = 0;
    let y = 0;
    for (const op of content.matchAll(/\/(F\d+) ([\d.]+) Tf|([-\d.]+) ([-\d.]+) Td|<([0-9a-fA-F]*)> Tj/g)) {
      if (op[1]) {
        font = resourceFonts.get(op[1]) ?? { name: op[1], cmap: new Map() };
        size = Number(op[2]);
      } else if (op[3] !== undefined) {
        x = Number(op[3]);
        y = Number(op[4]);
      } else {
        const codes = op[5].toLowerCase().match(/.{4}/g) ?? [];
        const text = codes.map((code) => font.cmap.get(code) ?? '�').join('');
        runs.push({ text, font: font.name, size, x, y });
      }
    }
    return { width: box[2] - box[0], height: box[3] - box[1], runs };
  });
};

/** All runs of a page joined with single spaces. */
export const pageText = (page: PdfTextPage): string => page.runs.map((run) => run.text).join(' ');
