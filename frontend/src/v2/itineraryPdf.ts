import type { Trip } from '../api'
import type { Journey } from './journeyModel'
import { buildItineraryPdfLines, type PdfLine } from './shareItinerary'

const PAGE_W = 595
const PAGE_H = 842
const MARGIN_X = 48
const MARGIN_TOP = 52
const MARGIN_BOTTOM = 52

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

function buildContent(lines: PdfLine[]): string[] {
  const pages: string[][] = [[]]
  let y = PAGE_H - MARGIN_TOP
  let prev: Style | undefined

  const push = (cmd: string) => {
    pages[pages.length - 1].push(cmd)
  }

  const newPage = () => {
    pages.push([])
    y = PAGE_H - MARGIN_TOP
    prev = undefined
  }

  for (const line of lines) {
    const spec = STYLE[line.style]
    const wrapped = wrapText(line.text, charsFor(line.style))
    const lineHeight = spec.size + 3
    const block = extraBefore(line.style, prev) + wrapped.length * lineHeight + spec.gap
    if (y - block < MARGIN_BOTTOM) newPage()
    y -= extraBefore(line.style, prev)
    if (line.style === 'h2' && prev) {
      push('0.75 0.75 0.75 RG')
      push('0.6 w')
      push(`${MARGIN_X} ${y + 8} m ${PAGE_W - MARGIN_X} ${y + 8} l S`)
    }
    push('BT')
    push(`/${spec.font} ${spec.size} Tf`)
    push('0.12 0.12 0.12 rg')
    let first = true
    for (const part of wrapped) {
      y -= lineHeight
      const x = MARGIN_X + spec.indent
      if (first) {
        push(`1 0 0 1 ${x} ${y} Tm`)
        first = false
      } else {
        push(`0 ${-lineHeight} Td`)
      }
      push(`(${encodeWinAnsi(part)}) Tj`)
    }
    push('ET')
    y -= spec.gap
    prev = line.style
  }

  return pages.map((cmds) => cmds.join('\n') + '\n')
}

function buildPdf(lines: PdfLine[]): Blob {
  const contents = buildContent(lines)
  const objects: string[] = []
  const add = (body: string) => {
    objects.push(body)
    return objects.length
  }

  const font1 = add(
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
  )
  const font2 = add(
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
  )

  const contentIds: number[] = []
  const pageIds: number[] = []
  for (const stream of contents) {
    contentIds.push(
      add(`<< /Length ${latin1Bytes(stream).length} >>\nstream\n${stream}endstream`),
    )
  }

  const pagesIdPlaceholder = objects.length + contents.length + 1
  for (let i = 0; i < contents.length; i++) {
    pageIds.push(
      add(
        `<< /Type /Page /Parent ${pagesIdPlaceholder} 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 ${font1} 0 R /F2 ${font2} 0 R >> >> /Contents ${contentIds[i]} 0 R >>`,
      ),
    )
  }

  const pagesId = add(
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`,
  )
  if (pagesId !== pagesIdPlaceholder) {
    throw new Error('PDF page tree id mismatch')
  }
  const catalogId = add(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`)

  const chunks: string[] = ['%PDF-1.4\n']
  const offsets = [0]
  let pos = chunks[0].length
  for (let i = 0; i < objects.length; i++) {
    const obj = `${i + 1} 0 obj\n${objects[i]}\nendobj\n`
    offsets.push(pos)
    chunks.push(obj)
    pos += obj.length
  }
  const xrefStart = pos
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (let i = 1; i <= objects.length; i++) {
    xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`
  }
  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`
  chunks.push(xref, trailer)
  const bytes = latin1Bytes(chunks.join(''))
  const buffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(buffer).set(bytes)
  return new Blob([buffer], { type: 'application/pdf' })
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

export function downloadItineraryPdf(
  trip: Pick<Trip, 'name' | 'startDate' | 'endDate' | 'travelers'>,
  journey: Journey,
) {
  const blob = buildPdf(buildItineraryPdfLines(trip, journey))
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
