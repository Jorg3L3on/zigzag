# How the Mini RAG Works

## What is RAG?

**Retrieval-Augmented Generation (RAG)** is a pattern where, before asking an AI to answer a question, you first *retrieve* relevant documents from a knowledge base and *inject* them as context into the prompt. This grounds the AI's answer in your actual project documentation instead of relying on general training knowledge.

``` txt
Question ──► Retrieve relevant docs ──► Inject into prompt ──► Answer
```

---

## Pipeline Overview

``` txt
┌─────────────────────────────────────────────────────────────────┐
│  INDEXING (run once)                                            │
│                                                                 │
│  rag/docs/*.md  ──►  chunker  ──►  TF-IDF embedder  ──►  JSON  │
│                                                   vectors.json  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  QUERYING (run every time)                                      │
│                                                                 │
│  Question  ──►  embed query  ──►  cosine search  ──►  top-5    │
│                                         │                       │
│                              ┌──────────┴───────────┐          │
│                              │                       │          │
│                       WITH API KEY             WITHOUT API KEY  │
│                              │                       │          │
│                    inject into prompt          print chunks     │
│                    call Claude API             and exit         │
│                              │                                  │
│                         streamed answer                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Step 1 — Indexing (`npm run rag:index`)

### What happens

1. **Load** — `rag/src/chunker.ts` reads every `.md` file in `rag/docs/` recursively.
2. **Chunk** — Each file is split into sections by `##` headings. Sections longer than ~800 characters are further split by paragraphs. Each chunk keeps its source filename and heading as metadata.
3. **Embed** — `rag/src/embedder.ts` builds a **TF-IDF** vector for every chunk (see below).
4. **Save** — The full index (chunks + vectors + vocabulary + IDF weights) is written to `rag/index/vectors.json`.

### What TF-IDF means

TF-IDF stands for **Term Frequency – Inverse Document Frequency**. It is a classic information-retrieval technique that represents a text as a numeric vector:

| Component | Meaning |
|-----------|---------|
| **TF** (Term Frequency) | How often a word appears in *this* chunk, normalised by chunk length |
| **IDF** (Inverse Document Frequency) | How rare the word is across *all* chunks — rare words score higher |
| **TF × IDF** | Final weight: high for words that are frequent here but rare elsewhere |

Example: the word `company_id` appears in many chunks but not in every one — it gets a meaningful weight. The word `the` appears everywhere — its IDF is near zero so it's ignored automatically.

Each chunk becomes a vector of ~600 numbers (one per vocabulary word), most of them zero. This is called a **sparse vector**.

### No external API needed

The entire indexing step runs locally with zero network calls and zero new npm packages. It uses only Node.js built-ins and `ts-node` (already in devDependencies).

---

## Step 2 — Search (`npm run rag:search "..."`)

### What happens

1. The query string is tokenised and embedded using the **same** TF-IDF vocabulary and IDF weights that were saved during indexing.
2. **Cosine similarity** is computed between the query vector and every chunk vector in the index.
3. The top-5 chunks by score are printed to stdout.

### What cosine similarity means

Cosine similarity measures the angle between two vectors. A score of:

- **1.0** — identical word distribution (exact match)
- **0.5–0.8** — strong overlap of key terms
- **0.1–0.3** — some shared vocabulary
- **0.0** — no shared words at all

Because TF-IDF is keyword-based, queries with exact technical terms (`company_id`, `BigInt`, `deleted_at`) score very high on relevant chunks.

### Output

```txt
🔍 Query: "how does multi-tenancy work?"

### [1] 04-multi-tenancy.md — Multi-Tenancy (score: 0.729)
...chunk content...

### [2] 02-database-schema.md — Multi-tenancy Queries (score: 0.475)
...chunk content...
```

No LLM is involved — this is pure math. It runs in milliseconds.

---

## Step 3 — Ask (`npm run rag:ask "..."`)

This command combines retrieval with generation. It has two modes depending on whether `ANTHROPIC_API_KEY` is set in your `.env`.

---

### Mode A — Without `ANTHROPIC_API_KEY`

```txt
Question ──► Search ──► Print top-5 chunks ──► Exit
```

The script runs the search, prints the retrieved context in a readable format, then exits with this message:

```txt
⚠️  ANTHROPIC_API_KEY not set. Showing retrieved context only.
   Add ANTHROPIC_API_KEY=sk-... to your .env file to enable answers.
```

**Use case:** You can copy the printed context and paste it manually into Claude.ai or any other chat interface as additional context before asking your question.

---

### Mode B — With `ANTHROPIC_API_KEY`

```txt
Question ──► Search ──► Build prompt ──► Anthropic API ──► Streamed answer
```

#### What the prompt looks like

```txt
You are a helpful assistant for the tickets2.0 project...

## Documentation Context

### [1] 04-multi-tenancy.md — Multi-Tenancy (score: 0.729)
[...chunk content...]

### [2] 02-database-schema.md — ...
[...chunk content...]

## Question

how does multi-tenancy work?

## Instructions
- Be concise and technical
- Reference specific file paths when relevant
- Flag anything that contradicts CLAUDE.md
```

The retrieved chunks are injected verbatim into the `## Documentation Context` section. Claude's answer is grounded in your actual project docs, not general knowledge.

#### API call details

| Setting | Value |
|---------|-------|
| Model | `claude-sonnet-4-6` |
| Max tokens | 1024 |
| Streaming | Yes (tokens printed as they arrive) |
| Transport | Native `fetch()` — no SDK needed |

The `.env` file is loaded by a minimal built-in parser inside `ask.ts` — no `dotenv` package required.

---

## How to add `ANTHROPIC_API_KEY`

Open your `.env` file and add:

```env
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

You can get a key at [console.anthropic.com](https://console.anthropic.com). The key is only read locally by the `rag:ask` script — it is never committed (`.env` is in `.gitignore`).

---

## Limitations of TF-IDF

Because this is a keyword-based approach, it has some blind spots:

| Limitation | Example |
|------------|---------|
| No synonyms | Searching "remove record" won't match chunks that say "soft delete" |
| No semantic understanding | "how do I destroy a user" won't find the soft-delete docs |
| Exact spelling matters | `company_id` ≠ `companyId` |

**Workaround:** Use the same terminology as the docs. Technical queries with exact identifiers (`deleted_at`, `handleApiError`, `BigInt`) work very well.

For better semantic recall, see the "Upgrading to neural embeddings" section in [README.md](README.md).

---

## File Reference

| File | Role |
| ------ | ------ |
| [rag/src/chunker.ts](src/chunker.ts) | Splits `.md` files into chunks by `##` heading |
| [rag/src/embedder.ts](src/embedder.ts) | TF-IDF vectors and cosine similarity |
| [rag/src/vector-store.ts](src/vector-store.ts) | Save / load / search the JSON index |
| [rag/scripts/index-docs.ts](scripts/index-docs.ts) | CLI: build the index |
| [rag/scripts/search.ts](scripts/search.ts) | CLI: keyword search, no LLM |
| [rag/scripts/ask.ts](scripts/ask.ts) | CLI: full RAG with optional Anthropic answer |
| [rag/index/vectors.json](index/vectors.json) | Generated index (gitignored) |
| [rag/docs/](docs/) | Knowledge base — add `.md` files here |
