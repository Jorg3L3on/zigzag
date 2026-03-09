# Mini RAG — tickets2.0 Knowledge Base

A lightweight Retrieval-Augmented Generation system for the tickets2.0 project.
No external vector database. No embedding API. Runs fully offline.

## How It Works

```
rag/docs/*.md  →  chunker  →  TF-IDF embedder  →  rag/index/vectors.json
                                                          ↓
question  ──────────────────────────────────────→  cosine search  →  top-k chunks
                                                          ↓
                                                 Anthropic API (optional)
                                                          ↓
                                                     answer
```

1. **Docs** — markdown files in `rag/docs/` are the knowledge base.
2. **Indexer** — splits docs into chunks and builds a TF-IDF vector index saved to `rag/index/vectors.json`.
3. **Search** — a query is vectorised the same way; cosine similarity ranks the chunks.
4. **Ask** — the top-k chunks are injected into a prompt sent to `claude-sonnet-4-6`.

## Quick Start

```bash
# 1. Build the index (run once, then re-run whenever docs change)
npm run rag:index

# 2. Search for relevant chunks (no LLM, instant)
npm run rag:search "how does multi-tenancy work?"

# 3. Ask a question and get an AI answer
#    Requires ANTHROPIC_API_KEY in your .env
npm run rag:ask "how do I add a new API route?"
```

## File Structure

```
rag/
├── docs/                      # ← Add your knowledge here
│   ├── 01-architecture.md
│   ├── 02-database-schema.md
│   ├── 03-authentication.md
│   ├── 04-multi-tenancy.md
│   ├── 05-api-and-actions.md
│   ├── 06-error-handling.md
│   ├── 07-onboarding.md
│   └── 08-business-rules.md
├── index/
│   └── vectors.json           # Generated — do not commit (see .gitignore)
├── scripts/
│   ├── index-docs.ts          # Build the index
│   ├── search.ts              # CLI similarity search
│   └── ask.ts                 # Full RAG Q&A
├── src/
│   ├── types.ts               # Shared types
│   ├── chunker.ts             # Markdown → chunks
│   ├── embedder.ts            # TF-IDF vectors + cosine similarity
│   └── vector-store.ts        # Save / load / search the index
└── tsconfig.json
```

## Adding New Documentation

1. Create a new `.md` file in `rag/docs/` — name it `NN-topic.md` to keep ordering.
2. Structure it with `##` headings (each becomes its own searchable chunk).
3. Re-run `npm run rag:index` to rebuild the index.

### Writing Good Docs for RAG

- Use `##` headings generously — each heading creates an independent chunk.
- Include exact names: function names, file paths, variable names. TF-IDF is keyword-based.
- Keep chunks focused: one concept per section.
- Avoid very long sections (> ~800 chars) — they get split and may lose context.

### Suggested Topics to Add

- [ ] Deployment (env vars, Docker, CI/CD)
- [ ] Testing strategy and test file conventions
- [ ] Component design patterns (how to add a new CRUD page)
- [ ] PDF generation with `html2pdf.js`
- [ ] Ticket → PDF export flow
- [ ] Role/permission assignment UI flow
- [ ] Common debugging tips

## Upgrading to Neural Embeddings (Optional)

The TF-IDF embedder in `rag/src/embedder.ts` is the default because it needs no API key and works offline. For better semantic recall:

1. Replace `buildIndex` and `embedQuery` in `embedder.ts` with calls to an embedding API (e.g. `text-embedding-3-small` from OpenAI — ~$0.02 / 1M tokens).
2. Update `VectorIndex` type to remove `vocabulary` / `idf` fields.
3. Re-run `npm run rag:index`.

The rest of the pipeline (vector-store, search, ask) is unchanged.

## Using With Claude Code (MCP)

You can expose the search function as an MCP tool so Claude Code can call it automatically:

1. In `.mcp.json`, register a tool that runs `npm run rag:search "<query>"`.
2. Agents will retrieve context before answering questions about the codebase.

## Requirements

- Node.js 18+ (for native `fetch`)
- `ts-node` (already in devDependencies)
- `ANTHROPIC_API_KEY` in `.env` (only needed for `rag:ask`)
