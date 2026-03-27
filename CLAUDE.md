# CLAUDE.md

This file provides guidance to Claude Code when working with the `arc6ai_info_extraction` project.

## User instruction
"After building or adding new features to the project or app, always run the tests and check the logs until every new functions and features work properly. And update both Readme.md and Claude.md."

## What this project does

`arc6ai_info_extraction` is a Cloudflare Worker that extracts content from any file and returns clean, well-structured Markdown. It merges the capabilities of `arc6ai_doc_extract` (text extraction) and `arc6ai_visual_intelligence` (vision/image extraction) into a single unified endpoint. Users don't need to know what kind of file they have — the worker detects format, tries text extraction, and automatically falls back to GPT-4o vision if the document is scanned or image-based.

**Supported formats**: PDF, DOCX, XLSX, XLS, PPTX, ODT, ODS, ODP, CSV, TXT, JSON, MD, PNG, JPG, JPEG, WEBP, GIF

**API endpoint**: `POST /extract` (multipart/form-data)
- `file` — required, the file to extract
- `prompt` — optional, custom prompt to override the default vision prompt (vision path only)

**Response**:
```json
{
  "content": "## Document Title\n\n...",
  "format": "pdf",
  "method": "text" | "vision",
  "model": "gpt-4o-mini" | "gpt-4o"
}
```

## Commands

```bash
npm install          # install dependencies
npm run dev          # local dev at http://localhost:3003 (tsx watch)
npm run build        # TypeScript check + wrangler dry-run
npm run deploy       # deploy to Cloudflare Workers
```

## Architecture

```
src/
  worker.ts                   # Cloudflare Workers entry point (wrangler main)
  server.ts                   # Local Node dev server (tsx watch)
  extractor/
    index.ts                  # Main pipeline: orchestrates text → judge → vision fallback
    text.ts                   # detectFormat(), extractText() — unpdf/mammoth/SheetJS/fflate
    judge.ts                  # isLowQuality() — pure heuristic, no LLM
    vision.ts                 # extractVision() — gpt-4o, images + scanned PDFs
    markdown.ts               # formatAsMarkdown() — gpt-4o-mini, chunked for large docs
```

### Extraction pipeline

1. **detectFormat** — infer from filename extension + optional MIME type
2. **IMAGE_FORMATS** (png/jpg/jpeg/webp/gif) — always go to vision path (no text to extract)
3. **Text extraction** — unpdf for PDF, mammoth for DOCX, SheetJS for XLSX/XLS, fflate for PPTX/ODT/ODS/ODP
4. **Quality judge** (PDF only, no LLM) — 3 heuristics: tiny text in large file, garbled char ratio >30%, unicode replacement chars
5. **Vision fallback** — if PDF is low quality (scanned), call gpt-4o with native PDF file content type
6. **Format as Markdown** — good text goes through gpt-4o-mini for clean formatting, chunked at 24k chars

### Models used
- `gpt-4o` — vision path (images and scanned PDFs); `max_tokens: 4000`
- `gpt-4o-mini` — text formatting path; `max_tokens: 8000` per chunk, parallel chunks

### Key implementation notes
- **mammoth arrayBuffer workaround**: `buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer` — required because Node Buffer shares underlying ArrayBuffer
- **PDF vision**: uses `{ type: 'file', file: { file_data: 'data:application/pdf;base64,...' } }` content type (GPT-4o native PDF support)
- **Image vision**: uses `{ type: 'image_url', image_url: { url: 'data:mime;base64,...', detail: 'high' } }`
- **Chunking**: 24k chars/chunk, splits on newlines (≥70% into chunk), chunks formatted in parallel with Promise.all
- **CF secret injection**: `process.env.OPENAI_API_KEY = env.OPENAI_API_KEY` at request time in worker.ts

### Cloudflare deployment

```bash
# Set secret (one-time)
npx wrangler secret put OPENAI_API_KEY

# Deploy
npm run deploy
```

Worker URL: `https://arc6ai-info-extraction.takshingchanai.workers.dev`

`nodejs_compat` compatibility flag is required (for unpdf WASM, mammoth, process.env).
