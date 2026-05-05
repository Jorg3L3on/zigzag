# RAG Implementation Analysis

> Analysis of the current mini-RAG implementation in `rag/`. No changes proposed.

---

## 1. Structure of a stored chunk in `vectors.json`

Each entry inside `chunks[]` is an **`IndexedChunk`** — a plain `Chunk` with an `embedding` array appended.

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Composite key: `"<source>::<heading>"` or `"<source>::<heading>::<partIndex>"` for oversized sections |
| `content` | `string` | Raw markdown text of the chunk (includes the `## Heading` line) |
| `source` | `string` | Relative path inside `rag/docs/`, e.g. `"01-architecture.md"` |
| `heading` | `string` | Nearest markdown heading with `#` stripped, e.g. `"Two Data-Access Layers"` |
| `embedding` | `number[]` | TF-IDF vector; length equals the vocabulary size (currently **616 floats**) |

**There is no additional metadata** beyond these five fields. No `createdAt`, `level`, `tags`, `chunkIndex`, or `totalChunks` per chunk.

---

## 2. How chunks are created (`chunker.ts`)

### Entry point

`loadDocuments(docsDir)` recursively finds all `.md` files under `rag/docs/`, reads each one, and calls `chunkMarkdown(content, relativePath)`.

### Splitting strategy

1. The file is split on level-2 headings (`\n(?=## )`), so each section from `##` onwards becomes a candidate chunk. Content before the first `##` (e.g. the `#` title line) is also kept as its own section.

2. **Small sections** (≤ 800 characters total): stored as a single chunk.

3. **Oversized sections** (> 800 characters): the body (everything after the first line) is further split on double newlines (`\n\n+`) into paragraph groups, each kept under 800 chars. The heading is re-prepended to every sub-chunk: `## Heading\n\nParagraph text…`

### What gets stored per chunk

```
id      = "<relativePath>::<heading>"           // small section
id      = "<relativePath>::<heading>::<index>"  // paragraph sub-chunk

content = full markdown text (heading line included)
source  = relative file path (forward slashes, no leading /)
heading = heading text with all leading # and spaces removed
```

### What is NOT captured

- Heading level (h1 vs h2 vs h3) — only `##` boundaries trigger splits
- Position within the file (line number, paragraph index beyond the sub-chunk suffix in `id`)
- File-level title or front-matter
- Sibling/parent heading context

---

## 3. How the vector index is stored (`vectors.json`)

The root object matches the `VectorIndex` interface:

```json
{
  "chunks": [ ...IndexedChunk[] ],
  "vocabulary": [ ...sorted string[] ],
  "idf": { "<token>": <number>, ... },
  "createdAt": "2026-03-09T19:47:38.823Z",
  "totalDocs": 53
}
```

| Field | Description |
|---|---|
| `chunks` | Array of all indexed chunks, each carrying its full TF-IDF embedding vector |
| `vocabulary` | Sorted array of every unique token across all documents (616 tokens currently) |
| `idf` | Map of `token → IDF weight`, pre-computed once at index time |
| `createdAt` | ISO timestamp of the last `rag:index` run |
| `totalDocs` | Number of chunks indexed (not number of source files) |

The index is a **single flat JSON file** (`rag/index/vectors.json`) loaded entirely into memory on every query. There is no pagination, sharding, or approximate-nearest-neighbor structure.

---

## 4. How search works (`vector-store.ts` + `embedder.ts`)

### Inputs

`search(query: string, index: VectorIndex, topK = 5)`

### Steps

1. **Embed the query** (`embedQuery`):
   - Tokenize: lowercase, strip non-alphanumeric, drop tokens ≤ 2 chars and the literal `"constructor"`.
   - Compute TF for the query tokens.
   - Project onto the stored `vocabulary` using the stored `idf` weights → dense vector of length 616.

2. **Score every chunk**: compute cosine similarity between the query vector and each chunk's stored `embedding`.

3. **Filter**: discard results with `score === 0` (no vocabulary overlap).

4. **Rank**: sort descending by score.

5. **Truncate**: return the top `topK` results (default 5).

### Result shape

Each `SearchResult` is:

```ts
{
  chunk: { id, content, source, heading },  // embedding stripped off
  score: number                              // cosine similarity [0, 1]
}
```

### Similarity formula

Standard cosine similarity:

```
score = (A · B) / (‖A‖ · ‖B‖)
```

Returns `0` if either vector is all-zeros (no shared vocabulary).

---

## 5. CLI argument parsing in `search.ts`

```ts
const query = process.argv.slice(2).join(' ').trim();
```

- Everything after `ts-node scripts/search.ts` is joined with spaces into a single query string.
- **No flags, options, or named arguments** are parsed. `--topK`, `--source`, etc. do not exist.
- If the resulting string is empty, the script prints usage and exits with code 1.
- `TOP_K` is hardcoded to `5` in the file; it cannot be changed via CLI.

The same identical pattern is used in `ask.ts`.

---

## 6. Metadata attached to the Claude prompt in `ask.ts`

`formatContext(results)` renders each retrieved chunk as:

```
### [1] 01-architecture.md — Two Data-Access Layers (score: 0.412)

<raw markdown content of the chunk>
```

The **system prompt** sent to Claude includes:

- A fixed role description ("helpful assistant for the ZigZag project…").
- The rendered context block above (`## Documentation Context`).
- The user's question (`## Question`).
- Three bullet instructions (be concise, reference file paths, flag contradictions with CLAUDE.md).

**What IS included per chunk in the prompt:**
- Source file path
- Section heading
- Cosine similarity score
- Full chunk content (raw markdown)

**What is NOT included:**
- Which result number / rank it is… actually it IS shown as `[1]`, `[2]`, etc.
- No chunk `id`, no `totalDocs`, no index `createdAt`.
- No system-level `system` message field — the role description is embedded inside the single `user` turn (the API call only passes `messages: [{ role: 'user', content: prompt }]`).

---

## 7. Real chunk example from `vectors.json`

```json
{
  "id": "01-architecture.md::Two Data-Access Layers::0",
  "content": "## Two Data-Access Layers\n\nThe project intentionally has two parallel layers for mutating data:\n\n### Server Actions (`src/actions/`)\n\n- Used by client components via the `'use server'` directive\n- Primary way for UI pages to mutate data\n- Files: `tickets.ts`, `clients.ts`, `users.ts`, `services.ts`, `roles.ts`, `permissions.ts`\n- Return shape: `{ success: boolean, data?, error? }` (some older ones return `{ user }` or throw)\n\n### API Routes (`src/app/api/`)\n\n- RESTful endpoints available for external consumers\n- Used by some components directly\n- Endpoints: `/api/auth`, `/api/clients`, `/api/companies`, `/api/services`, `/api/tickets`, `/api/users`, `/api/upload`\n- Must call `auth()` themselves — middleware does NOT protect them\n\nWhen editing logic, always check both layers. A bug in one often exists in the other.",
  "source": "01-architecture.md",
  "heading": "Two Data-Access Layers",
  "embedding": [ /* 616 floats — 72 non-zero — omitted for brevity */ ]
}
```

This chunk is a **paragraph sub-chunk** (suffix `::0`) because the original `## Two Data-Access Layers` section exceeded 800 characters. The heading was re-prepended to the content automatically by the chunker.

---

## Summary table

| Concern | Current behaviour |
|---|---|
| Chunk granularity | One chunk per `##` section; oversized ones split by paragraph |
| Max chunk size | 800 characters |
| Heading captured | Yes — nearest `##`, stored as plain text |
| Parent/file context | Source filename only; no title or breadcrumb |
| Embedding method | TF-IDF (offline, no external API) |
| Vector dimensions | Equal to vocabulary size (616 in current index) |
| Similarity metric | Cosine similarity |
| Storage format | Single flat JSON file |
| CLI flags | None — raw positional args joined into query string |
| LLM prompt metadata | Source path, heading, score, raw content per chunk |
| API call style | Single `user` turn (no `system` message field used) |
