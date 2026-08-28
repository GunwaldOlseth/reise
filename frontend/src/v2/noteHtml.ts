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
  'H1',
  'H2',
  'H3',
  'H4',
  'A',
  'IMG',
])

const SAFE_IMG_SRC = /^(https?:\/\/|\/api\/uploads\/)/i

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function isSafeNoteHref(href: string): boolean {
  const h = (href || '').trim()
  if (!h) return false
  return /^https?:\/\//i.test(h)
}

export function isSafeNoteImgSrc(src: string): boolean {
  const s = (src || '').trim()
  if (!s) return false
  return SAFE_IMG_SRC.test(s)
}

export function normalizeNoteLinkUrl(raw: string): string | null {
  const v = (raw || '').trim()
  if (!v) return null
  if (/^https?:\/\//i.test(v)) return v
  if (v.startsWith('//')) return `https:${v}`
  if (/^[\w.-]+\.[a-z]{2,}/i.test(v)) return `https://${v}`
  return null
}

export function looksLikeNoteHtml(raw: string): boolean {
  return /<\s*\/?\s*(p|br|div|ul|ol|li|strong|b|em|i|u|mark|blockquote|span|h[1-4]|a|img)\b/i.test(
    raw,
  )
}

function wrapStars(html: string): string {
  return html.replace(
    /(<span class="v2-note-star">★<\/span>)|★/g,
    (_full, already) => already || '<span class="v2-note-star">★</span>',
  )
}

function serializeAttrs(el: Element, names: string[]): string {
  const parts: string[] = []
  for (const name of names) {
    const v = el.getAttribute(name)
    if (v) parts.push(`${name}="${escapeHtml(v)}"`)
  }
  return parts.length ? ` ${parts.join(' ')}` : ''
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
    if (cls.includes('v2-note-check')) {
      const done =
        el.textContent?.includes('☑') ||
        el.closest('.v2-note-check-item')?.classList.contains('is-done')
      return `<span class="v2-note-check" contenteditable="false">${done ? '☑' : '☐'}</span>`
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
  if (tag === 'A') {
    const href = (el.getAttribute('href') || '').trim()
    if (!isSafeNoteHref(href)) return inner
    return `<a href="${escapeHtml(href)}"${serializeAttrs(el, ['target', 'rel'])}>${inner}</a>`
  }
  if (tag === 'IMG') {
    const src = (el.getAttribute('src') || '').trim()
    if (!isSafeNoteImgSrc(src)) return ''
    const alt = escapeHtml(el.getAttribute('alt') || '')
    return `<img src="${escapeHtml(src)}" alt="${alt}" class="v2-note-img" />`
  }
  if (tag === 'UL') {
    const isCheck = el.classList.contains('v2-note-checklist')
    const open = isCheck ? '<ul class="v2-note-checklist">' : '<ul>'
    if (!inner) return ''
    return `${open}${inner}</ul>`
  }
  if (tag === 'LI') {
    if (el.classList.contains('v2-note-check-item')) {
      const done = el.classList.contains('is-done')
      const cls = done ? 'v2-note-check-item is-done' : 'v2-note-check-item'
      if (!inner.trim()) return ''
      return `<li class="${cls}">${inner}</li>`
    }
    if (!inner.trim()) return ''
    return `<li>${inner}</li>`
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
  const src = raw || ''
  if (/<img\b/i.test(src)) return true
  const t = src
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
