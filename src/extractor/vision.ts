import OpenAI from 'openai'
import type { FileFormat } from './text.js'

const MIME_MAP: Partial<Record<FileFormat, string>> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  pdf: 'application/pdf',
}

// Prompt for scanned documents / PDFs — faithful full extraction
const DOCUMENT_PROMPT = `You are a document extraction expert. Extract ALL content from this scanned document faithfully.

Rules:
- Transcribe every word of text exactly as it appears
- Reproduce all tables as Markdown tables
- Use # for the document title, ## for sections, ### for subsections
- Preserve lists, numbered items, and indentation structure
- Do not summarise, interpret, or omit anything
- Output only the formatted Markdown, nothing else`

// Prompt for images — describe everything visible
const IMAGE_PROMPT = `You are a visual analyst. Examine this image carefully and describe everything you see in full detail.

Rules:
- If the image contains text (signs, labels, captions, UI, documents): transcribe it fully and accurately
- If the image contains a chart or graph: describe the type, title, axes, all data points, values, and trends
- If the image contains a table: reproduce it as a Markdown table
- If the image contains a diagram or flowchart: describe every element, label, and connection
- If the image contains a real-world scene: describe subjects, colors, quantities, positions, actions, setting
- If the image contains a screenshot or UI: describe the interface and extract all visible text
- Format your response as clean, well-structured Markdown
- Output only the formatted Markdown, nothing else`

export async function extractVision(
  client: OpenAI,
  buffer: Buffer,
  format: FileFormat,
  customPrompt?: string,
): Promise<string> {
  const mimeType = MIME_MAP[format]
  if (!mimeType) throw new Error(`Vision not supported for format: ${format}`)

  const base64 = buffer.toString('base64')
  const isPdf = format === 'pdf'
  const prompt = customPrompt ?? (isPdf ? DOCUMENT_PROMPT : IMAGE_PROMPT)

  const content: OpenAI.Chat.ChatCompletionContentPart[] = isPdf
    ? [
        { type: 'text', text: prompt },
        // GPT-4o supports PDF natively via the file content type
        { type: 'file', file: { file_data: `data:${mimeType};base64,${base64}` } } as unknown as OpenAI.Chat.ChatCompletionContentPartText,
      ]
    : [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}`, detail: 'high' } },
      ]

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 4000,
    messages: [{ role: 'user', content }],
  })

  return response.choices[0].message.content ?? ''
}
