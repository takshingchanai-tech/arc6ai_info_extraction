import OpenAI from 'openai'

const CHUNK_SIZE = 24000
const CHUNK_MAX_TOKENS = 8000

function splitIntoChunks(text: string): string[] {
  const chunks: string[] = []
  let i = 0
  while (i < text.length) {
    let end = Math.min(i + CHUNK_SIZE, text.length)
    if (end < text.length) {
      const lastNewline = text.lastIndexOf('\n', end)
      if (lastNewline > i + CHUNK_SIZE * 0.7) end = lastNewline + 1
    }
    chunks.push(text.slice(i, end))
    i = end
  }
  return chunks
}

async function formatChunk(
  client: OpenAI,
  chunk: string,
  filename: string,
  chunkIndex: number,
  totalChunks: number,
): Promise<string> {
  const isFirst = chunkIndex === 0
  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0,
    max_tokens: CHUNK_MAX_TOKENS,
    messages: [
      {
        role: 'system',
        content: `You are a document formatter. Format the following extracted document content as clean, well-structured Markdown.

Rules:
- Preserve ALL content — do not summarise, omit, or analyse anything
- Add clear structure: use # for the document title (first chunk only), ## for sections, bullet points for lists, and | tables | for tabular data
- Clean up redundant whitespace and OCR artifacts but keep all words
- For spreadsheets/CSV: render data as Markdown tables
- For presentations: use ## Slide N as headers
- Do not add commentary, interpretation, or analysis
- Output only the formatted Markdown, nothing else
${!isFirst ? '- This is a continuation chunk — do NOT add a document title, just continue formatting' : ''}`,
      },
      {
        role: 'user',
        content: `Filename: ${filename} (part ${chunkIndex + 1} of ${totalChunks})\n\n${chunk}`,
      },
    ],
  })
  return response.choices[0].message.content ?? chunk
}

export async function formatAsMarkdown(client: OpenAI, text: string, filename: string): Promise<string> {
  const chunks = splitIntoChunks(text)
  if (chunks.length === 1) return formatChunk(client, chunks[0], filename, 0, 1)
  const parts = await Promise.all(chunks.map((c, i) => formatChunk(client, c, filename, i, chunks.length)))
  return parts.join('\n\n')
}
