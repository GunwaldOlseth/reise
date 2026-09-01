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
const STORED_UPLOAD_SRC = /^\/api\/uploads\/[A-Za-z0-9._-]+$/i
const ABS_UPLOAD_SRC =
  /^https?:\/\/[^/]+\/api\/uploads\/([A-Za-z0-9._-]+)$/i

/** Stored note HTML always uses relative `/api/uploads/…` paths. */
export function normalizeStoredNoteImgSrc(src: string): string {
  const v = (src || '').trim()
  if (!v) return ''
  if (STORED_UPLOAD_SRC.test(v)) return v
  const m = v.match(ABS_UPLOAD_SRC)
  if (m) return `/api/uploads/${m[1]}`
  return v
}

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
    const src = normalizeStoredNoteImgSrc(el.getAttribute('src') || '')
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

function applyPastedInlineStyles(el: HTMLElement, inner: string): string {
  if (!inner) return ''
  let out = inner
  const style = el.style
  const fw = style.fontWeight || ''
  const fwNum = parseInt(fw, 10)
  const isBold =
    el.tagName === 'B' ||
    el.tagName === 'STRONG' ||
    fw === 'bold' ||
    fw === 'bolder' ||
    (!Number.isNaN(fwNum) && fwNum >= 600)
  const isItalic =
    el.tagName === 'I' ||
    el.tagName === 'EM' ||
    style.fontStyle === 'italic'
  const isUnderline =
    el.tagName === 'U' || (style.textDecoration || '').includes('underline')
  const bg = style.backgroundColor || el.getAttribute('bgcolor') || ''
  const isHighlight =
    el.tagName === 'MARK' ||
    (bg &&
      bg !== 'transparent' &&
      bg !== 'inherit' &&
      bg !== 'initial' &&
      bg !== 'rgba(0, 0, 0, 0)')

  if (isBold) out = `<strong>${out}</strong>`
  if (isItalic) out = `<em>${out}</em>`
  if (isUnderline) out = `<u>${out}</u>`
  if (isHighlight) out = `<mark>${out}</mark>`
  return out
}

const PASTE_SKIP_TAGS = new Set([
  'SCRIPT',
  'STYLE',
  'META',
  'LINK',
  'HEAD',
  'TITLE',
  'HTML',
])

function convertPastedNodes(nodes: Node[]): string {
  return nodes.map(convertPastedNode).join('')
}

function convertPastedNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return escapeHtml(node.textContent || '')
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return ''
  const el = node as HTMLElement
  const tag = el.tagName
  if (PASTE_SKIP_TAGS.has(tag)) return ''

  if (tag === 'BR') return '<br>'

  const inner = convertPastedNodes(Array.from(el.childNodes))

  if (tag === 'B' || tag === 'STRONG') return inner ? `<strong>${inner}</strong>` : ''
  if (tag === 'I' || tag === 'EM') return inner ? `<em>${inner}</em>` : ''
  if (tag === 'U') return inner ? `<u>${inner}</u>` : ''
  if (tag === 'MARK') return inner ? `<mark>${inner}</mark>` : ''
  if (tag === 'H1' || tag === 'H2' || tag === 'H3' || tag === 'H4') {
    const name = tag.toLowerCase()
    return inner.trim() ? `<${name}>${inner}</${name}>` : ''
  }
  if (tag === 'UL') {
    if (!inner.trim()) return ''
    const isCheck = el.classList.contains('v2-note-checklist')
    return isCheck
      ? `<ul class="v2-note-checklist">${inner}</ul>`
      : `<ul>${inner}</ul>`
  }
  if (tag === 'OL') return inner.trim() ? `<ol>${inner}</ol>` : ''
  if (tag === 'LI') {
    if (!inner.trim()) return ''
    if (el.classList.contains('v2-note-check-item')) {
      const done = el.classList.contains('is-done')
      const cls = done ? 'v2-note-check-item is-done' : 'v2-note-check-item'
      return `<li class="${cls}">${inner}</li>`
    }
    return `<li>${inner}</li>`
  }
  if (tag === 'A') {
    const href =
      normalizeNoteLinkUrl(el.getAttribute('href') || '') ||
      (isSafeNoteHref(el.getAttribute('href') || '')
        ? (el.getAttribute('href') || '').trim()
        : null)
    if (!href) return inner
    const label = inner.trim() || escapeHtml(href)
    return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${label}</a>`
  }
  if (tag === 'IMG') {
    const src = normalizeStoredNoteImgSrc(el.getAttribute('src') || '')
    if (!isSafeNoteImgSrc(src)) return ''
    return `<img src="${escapeHtml(src)}" alt="" class="v2-note-img" />`
  }
  if (tag === 'BLOCKQUOTE') {
    return inner.trim() ? `<blockquote>${inner}</blockquote>` : ''
  }
  if (
    tag === 'P' ||
    tag === 'DIV' ||
    tag === 'BODY' ||
    tag === 'SECTION' ||
    tag === 'ARTICLE'
  ) {
    const text = (el.textContent || '').replace(/\s+/g, '').trim()
    if (!text) return ''
    const blockInner = inner.trim()
    if (!blockInner) return ''
    return `<p>${blockInner}</p>`
  }
  if (tag === 'SPAN' || tag === 'FONT') {
    return applyPastedInlineStyles(el, inner)
  }

  return inner
}

/** Plain clipboard text → paragraphs (line breaks preserved). */
export function plainTextToNoteHtml(text: string): string {
  const raw = (text || '').replace(/\r\n/g, '\n')
  if (!raw.trim()) return ''
  const parts = raw.split('\n').map((line) => {
    const t = line.trim()
    if (!t) return ''
    return `<p>${escapeHtml(t)}</p>`
  })
  const joined = parts.filter(Boolean).join('')
  return joined || `<p>${escapeHtml(raw.trim())}</p>`
}

/** Word / browser HTML → safe note HTML with formatting kept where possible. */
export function normalizePastedNoteHtml(raw: string): string {
  const src = (raw || '').trim()
  if (!src) return ''
  const doc = new DOMParser().parseFromString(src, 'text/html')
  const converted = convertPastedNodes(Array.from(doc.body.childNodes))
  if (!converted.trim()) return ''
  return sanitizeNoteHtml(converted)
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

/** Resolve upload paths for display (editor + preview). */
export function noteHtmlForDisplay(
  raw: string,
  resolveMediaUrl: (pathOrUrl: string) => string,
): string {
  const html = sanitizeNoteHtml(raw || '')
  if (!html || !/<img\b/i.test(html)) return html
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html')
  const root = doc.body.firstElementChild
  if (!root) return html
  root.querySelectorAll('img').forEach((img) => {
    const src = normalizeStoredNoteImgSrc(img.getAttribute('src') || '')
    if (!isSafeNoteImgSrc(src)) {
      img.remove()
      return
    }
    img.setAttribute('src', resolveMediaUrl(src))
  })
  return root.innerHTML
}
