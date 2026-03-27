/**
 * Cloudflare Workers entry point.
 * OPENAI_API_KEY must be set as a Worker secret via wrangler.
 */
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import OpenAI from 'openai'
import { run } from './extractor/index.js'

const app = new Hono()

app.use('*', cors())

app.get('/health', (c) => c.json({ status: 'ok', service: 'arc6ai_info_extraction' }))

app.post('/extract', async (c) => {
  const env = c.env as Record<string, string>
  if (env.OPENAI_API_KEY) process.env.OPENAI_API_KEY = env.OPENAI_API_KEY

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

  const rawFlag = formData.get('raw')
  const raw = rawFlag === 'true' || rawFlag === '1'

  const arrayBuffer = await fileEntry.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  try {
    const result = await run(client, {
      buffer,
      filename: fileEntry.name,
      mimetype: fileEntry.type || undefined,
      prompt: customPrompt,
      raw,
    })
    return c.json(result)
  } catch (err) {
    const message = (err as Error).message
    console.error('[arc6ai_info_extraction] Error:', message)
    return c.json({ error: message }, 500)
  }
})

export default app
