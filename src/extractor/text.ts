import { extractText as unpdfExtractText, getDocumentProxy } from 'unpdf'
import mammoth from 'mammoth'
import * as XLSX from 'xlsx'
import { unzipSync } from 'fflate'

export type FileFormat =
  | 'pdf' | 'docx' | 'xlsx' | 'xls' | 'pptx'
  | 'odt' | 'ods' | 'odp'
  | 'csv' | 'txt' | 'json' | 'md'
  | 'png' | 'jpg' | 'jpeg' | 'webp' | 'gif'
  | 'unknown'

export interface TextExtractResult {
  text: string
  format: FileFormat
  sizeBytes: number
}

function stripXml(xml: string): string {
  return xml
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/\s+/g, ' ').trim()
}

export function detectFormat(filename: string, mimetype?: string): FileFormat {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  if (ext === 'pdf' || mimetype === 'application/pdf') return 'pdf'
  if (ext === 'docx') return 'docx'
  if (ext === 'xlsx') return 'xlsx'
  if (ext === 'xls') return 'xls'
  if (ext === 'pptx') return 'pptx'
  if (ext === 'odt') return 'odt'
  if (ext === 'ods') return 'ods'
  if (ext === 'odp') return 'odp'
  if (ext === 'csv') return 'csv'
  if (ext === 'txt') return 'txt'
  if (ext === 'json') return 'json'
  if (ext === 'md') return 'md'
  if (ext === 'png' || mimetype === 'image/png') return 'png'
  if (ext === 'jpg' || ext === 'jpeg' || mimetype === 'image/jpeg') return 'jpg'
  if (ext === 'webp' || mimetype === 'image/webp') return 'webp'
  if (ext === 'gif' || mimetype === 'image/gif') return 'gif'
  return 'unknown'
}

export const IMAGE_FORMATS = new Set<FileFormat>(['png', 'jpg', 'jpeg', 'webp', 'gif'])
export const VISION_FORMATS = new Set<FileFormat>(['pdf', 'png', 'jpg', 'jpeg', 'webp', 'gif'])

export async function extractText(buffer: Buffer, format: FileFormat): Promise<string> {
  switch (format) {
    case 'pdf': {
      const pdf = await getDocumentProxy(new Uint8Array(buffer))
      const { text } = await unpdfExtractText(pdf, { mergePages: true })
      return text
    }
    case 'docx': {
      const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer
      const result = await mammoth.extractRawText({ arrayBuffer })
      return result.value
    }
    case 'xlsx':
    case 'xls': {
      const workbook = XLSX.read(buffer, { type: 'buffer' })
      return workbook.SheetNames
        .map(name => `=== Sheet: ${name} ===\n${XLSX.utils.sheet_to_csv(workbook.Sheets[name])}`)
        .join('\n\n')
    }
    case 'pptx': {
      const zip = unzipSync(new Uint8Array(buffer))
      return Object.entries(zip)
        .filter(([p]) => /^ppt\/slides\/slide(\d+)\.xml$/.test(p))
        .sort(([a], [b]) => {
          const ai = Number(a.match(/slide(\d+)/)?.[1])
          const bi = Number(b.match(/slide(\d+)/)?.[1])
          return ai - bi
        })
        .map(([p, d], i) => `=== Slide ${i + 1} ===\n${stripXml(new TextDecoder().decode(d))}`)
        .join('\n\n')
    }
    case 'odt':
    case 'ods':
    case 'odp': {
      const zip = unzipSync(new Uint8Array(buffer))
      const content = zip['content.xml']
      if (!content) throw new Error('No content.xml — may not be a valid ODF file')
      return stripXml(new TextDecoder().decode(content))
    }
    case 'json': {
      const raw = buffer.toString('utf-8')
      try { return JSON.stringify(JSON.parse(raw), null, 2) } catch { return raw }
    }
    case 'csv':
    case 'txt':
    case 'md':
      return buffer.toString('utf-8')
    default:
      throw new Error(`No text extractor for format: ${format}`)
  }
}
