import 'dotenv/config'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import OpenAI from 'openai'
import { run } from './extractor/index.js'

const app = new Hono()

app.get('/health', (c) => c.json({ status: 'ok', service: 'arc6ai_info_extraction' }))

app.post('/extract', async (c) => {
  let formData: FormData
  try {
    formData = await c.req.formData()
  } catch {
    return c.json({ error: 'Request must be multipart/form-data' }, 400)
  }

  const fileEntry = formData.get('file')
  if (!fileEntry || !(fileEntry instanceof File)) {
    return c.json({ error: 'Missing file field — provide a single file' }, 400)
  }

  const prompt = formData.get('prompt')
  const customPrompt = typeof prompt === 'string' && prompt.trim() ? prompt.trim() : undefined

  const arrayBuffer = await fileEntry.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  try {
    const result = await run(client, {
      buffer,
      filename: fileEntry.name,
      mimetype: fileEntry.type || undefined,
      prompt: customPrompt,
    })
    return c.json(result)
  } catch (err) {
    const message = (err as Error).message
    console.error('[arc6ai_info_extraction] Error:', message)
    return c.json({ error: message }, 500)
  }
})

const port = Number(process.env.PORT ?? 3003)
console.log(`arc6ai_info_extraction running on http://localhost:${port}`)

serve({ fetch: app.fetch, port })
