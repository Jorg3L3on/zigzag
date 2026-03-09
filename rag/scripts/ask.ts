#!/usr/bin/env ts-node
/**
 * rag:ask — retrieves relevant doc chunks and sends them as context to
 * the Anthropic API (claude-sonnet-4-6) to generate a grounded answer.
 *
 * Requires ANTHROPIC_API_KEY in the environment (reads from .env).
 * Without the key it still prints the retrieved context so you can paste
 * it manually into Claude.
 *
 * Run:  npm run rag:ask "how do I add a new API route?"
 */

import * as path from 'path';
import * as fs from 'fs';
import { loadIndex, search, formatContext } from '../src/vector-store';
import { SearchFilters } from '../src/types';

const INDEX_PATH = path.join(__dirname, '..', 'index', 'vectors.json');
const TOP_K = 5;
const MODEL = 'claude-sonnet-4-6';

// Minimal .env loader (avoids dotenv dependency)
function loadEnv() {
  const envPath = path.join(__dirname, '..', '..', '.env');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
    }
  }
}

async function callAnthropic(prompt: string, apiKey: string): Promise<void> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      stream: true,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${err}`);
  }

  // Stream server-sent events
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (data === '[DONE]') return;
      try {
        const parsed = JSON.parse(data);
        if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
          process.stdout.write(parsed.delta.text);
        }
      } catch {
        // ignore parse errors on non-JSON SSE lines
      }
    }
  }
}

// Split argv into positional query words and --key=value flags.
// npm 7+ intercepts --flag=value before the child process sees them and
// injects them as npm_config_<flag> env vars instead, so we check both.
function parseArgs(argv: string[]): { question: string; filters: SearchFilters } {
  const filters: SearchFilters = {};
  const queryParts: string[] = [];
  for (const arg of argv) {
    const m = arg.match(/^--([a-zA-Z]+)=(.+)$/);
    if (m) {
      if (m[1] === 'source') filters.source = m[2];
      if (m[1] === 'after') filters.after = m[2];
    } else {
      queryParts.push(arg);
    }
  }
  // Fallback: npm 7+ passes --key=value as npm_config_key env vars
  if (!filters.source && process.env.npm_config_source) filters.source = process.env.npm_config_source;
  if (!filters.after && process.env.npm_config_after) filters.after = process.env.npm_config_after;
  return { question: queryParts.join(' ').trim(), filters };
}

async function main() {
  loadEnv();

  const { question, filters } = parseArgs(process.argv.slice(2));
  if (!question) {
    console.error(
      'Usage: npm run rag:ask "<question>" [--source=<file>] [--after=<ISO date>]'
    );
    process.exit(1);
  }

  // ── Retrieve ─────────────────────────────────────────────────────────────
  const index = loadIndex(INDEX_PATH);
  const results = search(question, index, TOP_K, filters);
  const context = formatContext(results);

  console.log('\n📚 Retrieved context:\n');
  console.log(context);
  console.log('\n' + '='.repeat(70) + '\n');

  // ── Generate ─────────────────────────────────────────────────────────────
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.log(
      '⚠️  ANTHROPIC_API_KEY not set. Showing retrieved context only.\n' +
        '   Add ANTHROPIC_API_KEY=sk-... to your .env file to enable answers.\n'
    );
    return;
  }

  const prompt = `You are a helpful assistant for the tickets2.0 project (Next.js 15 + Prisma + MySQL + NextAuth v5).
Answer the question using ONLY the documentation context provided below. If the context does not contain enough information, say so clearly and briefly.

## Documentation Context

${context}

## Question

${question}

## Instructions
- Be concise and technical
- Reference specific file paths or sections when relevant
- If you spot something that contradicts CLAUDE.md or known project constraints, flag it`;

  console.log('🤖 Answer:\n');
  await callAnthropic(prompt, apiKey);
  console.log('\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
