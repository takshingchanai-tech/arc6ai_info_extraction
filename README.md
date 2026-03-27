# arc6ai_info_extraction

A Cloudflare Worker that extracts content from any document or image and returns clean, well-structured Markdown. Combines text extraction and AI vision into a single unified endpoint — users don't need to know what kind of file they have.

## Supported Formats

| Category | Formats |
|---|---|
| Documents | PDF, DOCX, PPTX, ODT, ODP |
| Spreadsheets | XLSX, XLS, ODS, CSV |
| Plain text | TXT, JSON, MD |
| Images | PNG, JPG, JPEG, WEBP, GIF |

## API

### `POST /extract`

Extracts content from a file and returns Markdown.

**Request** — multipart/form-data:
| Field | Required | Description |
|---|---|---|
| `file` | Yes | File to extract |
| `prompt` | No | Custom vision prompt (overrides default; vision path only) |

**Response**:
```json
{
  "content": "## Document Title\n\n...",
  "format": "pdf",
  "method": "text",
  "model": "gpt-4o-mini"
}
```

| Field | Values | Meaning |
|---|---|---|
| `method` | `"text"` / `"vision"` | How content was extracted |
| `model` | `"gpt-4o-mini"` / `"gpt-4o"` | Which model was used |

### `GET /health`

Returns `{ "status": "ok", "service": "arc6ai_info_extraction" }`.

## How It Works

```
File uploaded
     │
     ▼
detectFormat (extension + MIME)
     │
     ├─ Image (PNG/JPG/WEBP/GIF) ──────────────────► GPT-4o vision → Markdown
     │
     ▼
Text extraction (unpdf / mammoth / SheetJS / fflate)
     │
     ├─ PDF + low quality? (scanned/image-only) ──► GPT-4o vision → Markdown
     │    (heuristics: tiny text, garbled chars,
     │     unicode replacement chars)
     │
     ▼
GPT-4o-mini → clean Markdown (chunked, parallel)
```

## Development

```bash
npm install
cp .env.example .env   # add OPENAI_API_KEY
npm run dev            # http://localhost:3003
```

## Deployment

```bash
# One-time: set the secret
npx wrangler secret put OPENAI_API_KEY

# Deploy
npm run deploy
```

Live at: `https://arc6ai-info-extraction.takshingchanai.workers.dev`

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `OPENAI_API_KEY` | Yes | OpenAI API key (set as Wrangler secret in production) |

## Part of Arc6AI Skills

This worker is the backend for the **Document Intelligence** skill on [arc6ai.com](https://arc6ai.com). It is also called by the **Invoice Processing** skill (`arc6ai_invoice_processing`) to extract raw content before structured field extraction.
