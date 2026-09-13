import { mediaUrl, type Trip } from '../api'
import type { Journey } from './journeyModel'
import {
  buildItineraryPdfLines,
  buildPdfPhotoGroups,
  pdfDailyAppendixEnabled,
  type PdfDailyAppendixOptions,
  type PdfLine,
} from './shareItinerary'

export type { PdfDailyAppendixOptions }

const PAGE_W = 595
const PAGE_H = 842
const MARGIN_X = 48
const MARGIN_TOP = 52
const MARGIN_BOTTOM = 52
const CONTENT_W = PAGE_W - MARGIN_X * 2
const MAX_IMAGE_H = 240
const IMAGE_GAP = 10

type Style = PdfLine['style']

const STYLE: Record<
  Style,
  { font: 'F1' | 'F2'; size: number; indent: number; gap: number }
> = {
  h1: { font: 'F2', size: 18, indent: 0, gap: 8 },
  h2: { font: 'F2', size: 13, indent: 0, gap: 10 },
  meta: { font: 'F1', size: 10, indent: 0, gap: 4 },
  place: { font: 'F2', size: 11, indent: 0, gap: 3 },
  hop: { font: 'F1', size: 10, indent: 16, gap: 2 },
  sub: { font: 'F1', size: 10, indent: 16, gap: 2 },
}

type PdfLayoutItem =
  | { kind: 'text'; line: PdfLine }
  | { kind: 'image'; jpeg: Uint8Array; w: number; h: number }

type RegisteredImage = {
  name: string
  jpeg: Uint8Array
  w: number
  h: number
}

function extraBefore(style: Style, prev?: Style): number {
  if (style === 'h2') return prev ? 16 : 4
  if (style === 'place' && (prev === 'hop' || prev === 'sub')) return 8
  if (style === 'h1') return 0
  return 0
}

function wrapText(text: string, maxChars: number): string[] {
  const raw = text.replace(/\s+/g, ' ').trim()
  if (!raw) return ['']
  if (raw.length <= maxChars) return [raw]
  const words = raw.split(' ')
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (next.length <= maxChars) {
      current = next
      continue
    }
    if (current) lines.push(current)
    if (word.length <= maxChars) {
      current = word
      continue
    }
    for (let i = 0; i < word.length; i += maxChars) {
      const chunk = word.slice(i, i + maxChars)
      if (i + maxChars < word.length) lines.push(chunk)
      else current = chunk
    }
  }
  if (current) lines.push(current)
  return lines.length ? lines : ['']
}

function charsFor(style: Style): number {
  const width = PAGE_W - MARGIN_X * 2 - STYLE[style].indent
  const em = STYLE[style].size * 0.5
  return Math.max(24, Math.floor(width / em))
}

function encodeWinAnsi(text: string): string {
  let out = ''
  for (const char of text) {
    if (char === '\\' || char === '(' || char === ')') {
      out += `\\${char}`
      continue
    }
    if (char === '\n' || char === '\r' || char === '\t') {
      out += ' '
      continue
    }
    const code = char.charCodeAt(0)
    if (code === 0x2013 || code === 0x2014 || code === 0x2212) {
      out += '-'
      continue
    }
    if (code === 0x00a0) {
      out += ' '
      continue
    }
    if (code === 0x2022) {
      out += '-'
      continue
    }
    if (code < 128) {
      out += char
      continue
    }
    if (code <= 255) {
      out += `\\${code.toString(8).padStart(3, '0')}`
      continue
    }
    out += '?'
  }
  return out
}

function latin1Bytes(source: string): Uint8Array {
  const out = new Uint8Array(source.length)
  for (let i = 0; i < source.length; i++) {
    out[i] = source.charCodeAt(i) & 0xff
  }
  return out
}

async function loadJpegForPdf(
  pathOrUrl: string,
  maxDim = 1400,
): Promise<{ jpeg: Uint8Array; w: number; h: number } | null> {
  if (typeof createImageBitmap !== 'function') return null
  try {
    const res = await fetch(mediaUrl(pathOrUrl))
    if (!res.ok) return null
    const blob = await res.blob()
    const bitmap = await createImageBitmap(blob)
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height))
    const w = Math.max(1, Math.round(bitmap.width * scale))
    const h = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      bitmap.close?.()
      return null
    }
    ctx.drawImage(bitmap, 0, 0, w, h)
    bitmap.close?.()
    const outBlob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.82),
    )
    if (!outBlob) return null
    return { jpeg: new Uint8Array(await outBlob.arrayBuffer()), w, h }
  } catch {
    return null
  }
}

export async function buildItineraryPdfLayout(
  trip: Pick<Trip, 'name' | 'startDate' | 'endDate' | 'travelers'>,
  journey: Journey,
  appendix?: PdfDailyAppendixOptions,
): Promise<PdfLayoutItem[]> {
  const lines = buildItineraryPdfLines(trip, journey, appendix)
  const items: PdfLayoutItem[] = lines.map((line) => ({ kind: 'text', line }))

  if (!appendix?.photos || !pdfDailyAppendixEnabled(appendix)) {
    return items
  }

  const groups = buildPdfPhotoGroups(journey)
  for (const group of groups) {
    items.push({
      kind: 'text',
      line: { style: 'place', text: group.dateLabel },
    })
    for (const url of group.urls) {
      const img = await loadJpegForPdf(url)
      if (img) items.push({ kind: 'image', ...img })
    }
  }

  return items
}

type PageDraft = {
  cmds: string[]
  imageNames: Set<string>
}

function layoutToPages(
  items: PdfLayoutItem[],
  registerImage: (jpeg: Uint8Array, w: number, h: number) => string,
): PageDraft[] {
  const pages: PageDraft[] = [{ cmds: [], imageNames: new Set() }]
  let y = PAGE_H - MARGIN_TOP
  let prev: Style | undefined

  const page = () => pages[pages.length - 1]

  const newPage = () => {
    pages.push({ cmds: [], imageNames: new Set() })
    y = PAGE_H - MARGIN_TOP
    prev = undefined
  }

  const ensureSpace = (need: number) => {
    if (y - need < MARGIN_BOTTOM) newPage()
  }

  for (const item of items) {
    if (item.kind === 'text') {
      const line = item.line
      const spec = STYLE[line.style]
      const wrapped = wrapText(line.text, charsFor(line.style))
      const lineHeight = spec.size + 3
      const block =
        extraBefore(line.style, prev) + wrapped.length * lineHeight + spec.gap
      ensureSpace(block)
      y -= extraBefore(line.style, prev)
      if (line.style === 'h2' && prev) {
        page().cmds.push('0.75 0.75 0.75 RG')
        page().cmds.push('0.6 w')
        page().cmds.push(`${MARGIN_X} ${y + 8} m ${PAGE_W - MARGIN_X} ${y + 8} l S`)
      }
      page().cmds.push('BT')
      page().cmds.push(`/${spec.font} ${spec.size} Tf`)
      page().cmds.push('0.12 0.12 0.12 rg')
      let first = true
      for (const part of wrapped) {
        y -= lineHeight
        const x = MARGIN_X + spec.indent
        if (first) {
          page().cmds.push(`1 0 0 1 ${x} ${y} Tm`)
          first = false
        } else {
          page().cmds.push(`0 ${-lineHeight} Td`)
        }
        page().cmds.push(`(${encodeWinAnsi(part)}) Tj`)
      }
      page().cmds.push('ET')
      y -= spec.gap
      prev = line.style
      continue
    }

    const scale = Math.min(CONTENT_W / item.w, MAX_IMAGE_H / item.h, 1)
    const dw = item.w * scale
    const dh = item.h * scale
    ensureSpace(dh + IMAGE_GAP + 4)
    y -= 4
    const name = registerImage(item.jpeg, item.w, item.h)
    page().imageNames.add(name)
    const bottom = y - dh
    page().cmds.push('q')
    page().cmds.push(`${dw.toFixed(2)} 0 0 ${dh.toFixed(2)} ${MARGIN_X} ${bottom.toFixed(2)} cm`)
    page().cmds.push(`/${name} Do`)
    page().cmds.push('Q')
    y = bottom - IMAGE_GAP
    prev = undefined
  }

  return pages
}

type PdfObjectPart =
  | { kind: 'text'; text: string }
  | { kind: 'bytes'; data: Uint8Array }

function buildPdfFromLayout(items: PdfLayoutItem[]): Blob {
  const images: RegisteredImage[] = []
  let imageSeq = 0

  const registerImage = (jpeg: Uint8Array, w: number, h: number) => {
    imageSeq += 1
    const name = `Im${imageSeq}`
    images.push({ name, jpeg, w, h })
    return name
  }

  const pageDrafts = layoutToPages(items, registerImage)
  const parts: PdfObjectPart[] = []
  const objectStarts: number[] = []
  let nextObjId = 1

  const addTextObject = (body: string): number => {
    const id = nextObjId++
    objectStarts.push(sumPartLen(parts))
    parts.push({
      kind: 'text',
      text: `${id} 0 obj\n${body}\nendobj\n`,
    })
    return id
  }

  const addStreamObject = (dict: string, data: Uint8Array): number => {
    const id = nextObjId++
    objectStarts.push(sumPartLen(parts))
    parts.push({ kind: 'text', text: `${id} 0 obj\n${dict}\nstream\n` })
    parts.push({ kind: 'bytes', data })
    parts.push({ kind: 'text', text: '\nendstream\nendobj\n' })
    return id
  }

  const font1 = addTextObject(
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
  )
  const font2 = addTextObject(
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
  )

  const imageObjIds = new Map<string, number>()
  for (const img of images) {
    const id = addStreamObject(
      `<< /Type /XObject /Subtype /Image /Width ${img.w} /Height ${img.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.jpeg.length} >>`,
      img.jpeg,
    )
    imageObjIds.set(img.name, id)
  }

  const contentIds: number[] = []
  for (const draft of pageDrafts) {
    const stream = draft.cmds.join('\n') + '\n'
    contentIds.push(
      addStreamObject(
        `<< /Length ${latin1Bytes(stream).length} >>`,
        latin1Bytes(stream),
      ),
    )
  }

  const pagesId = nextObjId + pageDrafts.length
  const pageIds: number[] = []
  for (let i = 0; i < pageDrafts.length; i++) {
    const draft = pageDrafts[i]
    const xobjectParts = [...draft.imageNames]
      .sort()
      .map((name) => `/${name} ${imageObjIds.get(name)} 0 R`)
      .join(' ')
    const xobjects =
      xobjectParts.length > 0 ? ` /XObject << ${xobjectParts} >>` : ''
    pageIds.push(
      addTextObject(
        `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 ${font1} 0 R /F2 ${font2} 0 R >>${xobjects} >> /Contents ${contentIds[i]} 0 R >>`,
      ),
    )
  }

  const pagesIdActual = addTextObject(
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`,
  )
  if (pagesIdActual !== pagesId) {
    throw new Error('PDF page tree id mismatch')
  }
  const catalogId = addTextObject(
    `<< /Type /Catalog /Pages ${pagesIdActual} 0 R >>`,
  )

  const header = '%PDF-1.4\n'
  const bodyLen = sumPartLen(parts)
  const xrefStart = header.length + bodyLen
  let xref = `xref\n0 ${objectStarts.length + 1}\n0000000000 65535 f \n`
  for (let i = 0; i < objectStarts.length; i++) {
    xref += `${String(header.length + objectStarts[i]).padStart(10, '0')} 00000 n \n`
  }
  const trailer = `trailer\n<< /Size ${objectStarts.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`

  const totalLen = header.length + bodyLen + latin1Bytes(xref + trailer).length
  const out = new Uint8Array(totalLen)
  let offset = 0
  for (let i = 0; i < header.length; i++) out[offset++] = header.charCodeAt(i)
  for (const part of parts) {
    if (part.kind === 'text') {
      for (let i = 0; i < part.text.length; i++) {
        out[offset++] = part.text.charCodeAt(i) & 0xff
      }
    } else {
      out.set(part.data, offset)
      offset += part.data.length
    }
  }
  const tail = latin1Bytes(xref + trailer)
  out.set(tail, offset)
  return new Blob([out], { type: 'application/pdf' })
}

function sumPartLen(parts: PdfObjectPart[]): number {
  let n = 0
  for (const part of parts) {
    n += part.kind === 'text' ? part.text.length : part.data.length
  }
  return n
}

function pdfFilename(name: string): string {
  const base =
    name
      .trim()
      .replace(/[<>:"/\\|?*]+/g, '')
      .replace(/\s+/g, ' ')
      .slice(0, 80) || 'reise'
  return `${base}.pdf`
}

export async function downloadItineraryPdf(
  trip: Pick<Trip, 'name' | 'startDate' | 'endDate' | 'travelers'>,
  journey: Journey,
  appendix?: PdfDailyAppendixOptions,
) {
  const layout = await buildItineraryPdfLayout(trip, journey, appendix)
  const blob = buildPdfFromLayout(layout)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = pdfFilename(trip.name || 'reise')
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1500)
}
