const ALLOWED = new Set([
  'P',
  'BR',
  'DIV',
  'UL',
  'OL',
  'LI',
  'STRONG',
  'B',
  'EM',
  'I',
  'U',
  'MARK',
  'BLOCKQUOTE',
])

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function looksLikeNoteHtml(raw: string): boolean {
  return /<\s*\/?\s*(p|br|div|ul|ol|li|strong|b|em|i|u|mark|blockquote|span)\b/i.test(
    raw,
  )
}

function wrapStars(html: string): string {
  return html.replace(
    /(<span class="v2-note-star">★<\/span>)|★/g,
    (_full, already) => already || '<span class="v2-note-star">★</span>',
  )
}

function serialize(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return escapeHtml(node.textContent || '')
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return ''
  const el = node as Element
  const tag = el.tagName
  if (tag === 'SCRIPT' || tag === 'STYLE') return ''
  const inner = Array.from(el.childNodes).map(serialize).join('')
  if (tag === 'SPAN' || tag === 'FONT') {
    const cls = (el.getAttribute('class') || '').toLowerCase()
    if (cls.includes('v2-note-star') && inner) {
      return `<span class="v2-note-star">${inner}</span>`
    }
    const style = (el.getAttribute('style') || '').toLowerCase()
    const highlighted =
      style.includes('background') || !!el.getAttribute('bgcolor')
    if (highlighted && inner) {
      if (/#d4a84a|rgb\s*\(\s*212\s*,\s*168\s*,\s*74/i.test(style)) {
        return `<mark>${inner}</mark>`
      }
      return inner
    }
    return inner
  }
  if (!ALLOWED.has(tag)) return inner
  if (tag === 'BR') return '<br>'
  const name = tag.toLowerCase()
  if (!inner && (tag === 'P' || tag === 'DIV')) return ''
  return `<${name}>${inner}</${name}>`
}

export function sanitizeNoteHtml(raw: string): string {
  const src = (raw || '').trim()
  if (!src) return ''
  if (!looksLikeNoteHtml(src)) {
    return wrapStars(escapeHtml(src).replace(/\n/g, '<br>'))
  }
  const doc = new DOMParser().parseFromString(`<div>${src}</div>`, 'text/html')
  const root = doc.body.firstElementChild
  if (!root) return ''
  return wrapStars(Array.from(root.childNodes).map(serialize).join(''))
}

export function noteHasContent(raw?: string | null): boolean {
  const t = (raw || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
  return t.length > 0
}

export function compactNoteHtml(html: string): string {
  const clean = sanitizeNoteHtml(html)
  return noteHasContent(clean) ? clean : ''
}
