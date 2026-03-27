import OpenAI from 'openai'
import { detectFormat, extractText, IMAGE_FORMATS, VISION_FORMATS } from './text.js'
import { isLowQuality } from './judge.js'
import { extractVision } from './vision.js'
import { formatAsMarkdown } from './markdown.js'
import type { FileFormat } from './text.js'

export interface ExtractionRequest {
  buffer: Buffer
  filename: string
  mimetype?: string
  prompt?: string   // optional custom prompt for vision path
}

export interface ExtractionResponse {
  content: string             // full extracted content as Markdown
  format: FileFormat
  method: 'text' | 'vision'
  model: 'gpt-4o-mini' | 'gpt-4o'
}

export async function run(client: OpenAI, req: ExtractionRequest): Promise<ExtractionResponse> {
  const format = detectFormat(req.filename, req.mimetype)

  if (format === 'unknown') {
    throw new Error(`Unsupported file format: ${req.filename}`)
  }

  // Images always go to vision — no text to extract
  if (IMAGE_FORMATS.has(format)) {
    const content = await extractVision(client, req.buffer, format, req.prompt)
    return { content, format, method: 'vision', model: 'gpt-4o' }
  }

  // Text-based formats — extract then check quality
  const rawText = await extractText(req.buffer, format)

  // For vision-compatible formats (PDF), check quality and fall back to vision if scanned
  if (VISION_FORMATS.has(format) && isLowQuality(rawText, req.buffer.length)) {
    const content = await extractVision(client, req.buffer, format, req.prompt)
    return { content, format, method: 'vision', model: 'gpt-4o' }
  }

  // Good quality text — format as clean Markdown
  const content = await formatAsMarkdown(client, rawText, req.filename)
  return { content, format, method: 'text', model: 'gpt-4o-mini' }
}
