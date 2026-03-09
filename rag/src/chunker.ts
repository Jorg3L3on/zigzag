import * as fs from 'fs';
import * as path from 'path';
import { Chunk } from './types';

const MAX_CHUNK_CHARS = 800;

// Recursively find all .md files in a directory
function findMarkdownFiles(dir: string): string[] {
  const files: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...findMarkdownFiles(full));
    } else if (entry.name.endsWith('.md')) {
      files.push(full);
    }
  }
  return files.sort();
}

// Split a large body of text into paragraph-based chunks
function splitByParagraphs(text: string, maxChars: number): string[] {
  const parts: string[] = [];
  const paragraphs = text.split(/\n\n+/);
  let current = '';

  for (const para of paragraphs) {
    const candidate = current ? current + '\n\n' + para : para;
    if (candidate.length > maxChars && current) {
      parts.push(current.trim());
      current = para;
    } else {
      current = candidate;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

// Split a markdown file into semantic chunks (one per ## section)
function chunkMarkdown(content: string, source: string): Chunk[] {
  const chunks: Chunk[] = [];

  // Split on level-2 headings (##); keep the heading in each section
  const sections = content.split(/\n(?=## )/);

  for (const section of sections) {
    if (!section.trim()) continue;

    const firstLine = section.split('\n')[0];
    const heading = firstLine.replace(/^#+\s*/, '').trim();
    const body = section.slice(firstLine.length).trim();

    if (section.length <= MAX_CHUNK_CHARS) {
      chunks.push({
        id: `${source}::${heading}`,
        content: section.trim(),
        source,
        heading,
      });
    } else {
      // Break oversized sections into paragraph chunks
      const parts = splitByParagraphs(body, MAX_CHUNK_CHARS);
      parts.forEach((part, i) => {
        chunks.push({
          id: `${source}::${heading}::${i}`,
          content: `## ${heading}\n\n${part}`,
          source,
          heading,
        });
      });
    }
  }

  return chunks;
}

export function loadDocuments(docsDir: string): Chunk[] {
  const files = findMarkdownFiles(docsDir);
  const chunks: Chunk[] = [];

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    const relativePath = path.relative(docsDir, file).replace(/\\/g, '/');
    chunks.push(...chunkMarkdown(content, relativePath));
  }

  console.log(`  Loaded ${files.length} files → ${chunks.length} chunks`);
  return chunks;
}
