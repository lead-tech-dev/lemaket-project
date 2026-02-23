const ALLOWED_TAGS = new Set([
  'A',
  'B',
  'BLOCKQUOTE',
  'BR',
  'DIV',
  'EM',
  'I',
  'LI',
  'OL',
  'P',
  'STRONG',
  'U',
  'UL'
])

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const applyInlineLegacyFormatting = (value: string): string => {
  let formatted = escapeHtml(value)
  formatted = formatted.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  formatted = formatted.replace(/__(.+?)__/g, '<u>$1</u>')
  formatted = formatted.replace(/\*(.+?)\*/g, '<em>$1</em>')
  return formatted
}

const legacyTextToHtml = (value: string): string => {
  const lines = value.replace(/\r\n/g, '\n').split('\n')
  const html: string[] = []
  let inList = false

  lines.forEach(line => {
    const trimmed = line.trim()
    const isListItem = trimmed.startsWith('- ')
    if (isListItem) {
      if (!inList) {
        html.push('<ul>')
        inList = true
      }
      html.push(`<li>${applyInlineLegacyFormatting(trimmed.slice(2).trim())}</li>`)
      return
    }

    if (inList) {
      html.push('</ul>')
      inList = false
    }

    if (!trimmed) {
      html.push('<p><br></p>')
      return
    }

    if (trimmed.startsWith('> ')) {
      html.push(`<blockquote><p>${applyInlineLegacyFormatting(trimmed.slice(2))}</p></blockquote>`)
      return
    }

    html.push(`<p>${applyInlineLegacyFormatting(trimmed)}</p>`)
  })

  if (inList) {
    html.push('</ul>')
  }

  return html.join('')
}

const isLikelyHtml = (value: string): boolean => /<\/?[a-z][\s\S]*>/i.test(value)

const sanitizeHref = (href: string): string | null => {
  const trimmed = href.trim()
  if (!trimmed) return null

  if (trimmed.startsWith('#') || trimmed.startsWith('/')) {
    return trimmed
  }

  if (/^(https?:|mailto:|tel:)/i.test(trimmed)) {
    return trimmed
  }

  return null
}

export const sanitizeRichTextHtml = (html: string): string => {
  if (!html.trim()) {
    return ''
  }

  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
    return html
  }

  const parser = new DOMParser()
  const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html')
  const root = doc.body.firstElementChild as HTMLElement | null
  if (!root) {
    return ''
  }

  const sanitizeNode = (node: Node) => {
    let child = node.firstChild

    while (child) {
      const next = child.nextSibling

      if (child.nodeType === Node.COMMENT_NODE) {
        node.removeChild(child)
        child = next
        continue
      }

      if (child.nodeType === Node.ELEMENT_NODE) {
        const element = child as HTMLElement
        const tagName = element.tagName.toUpperCase()

        if (!ALLOWED_TAGS.has(tagName)) {
          if (tagName === 'SCRIPT' || tagName === 'STYLE' || tagName === 'IFRAME') {
            node.removeChild(element)
          } else {
            while (element.firstChild) {
              node.insertBefore(element.firstChild, element)
            }
            node.removeChild(element)
          }
          child = next
          continue
        }

        Array.from(element.attributes).forEach(attribute => {
          const name = attribute.name.toLowerCase()
          if (tagName === 'A' && name === 'href') {
            const safeHref = sanitizeHref(attribute.value)
            if (safeHref) {
              element.setAttribute('href', safeHref)
              element.setAttribute('target', '_blank')
              element.setAttribute('rel', 'noopener noreferrer nofollow')
            } else {
              element.removeAttribute(attribute.name)
            }
            return
          }
          element.removeAttribute(attribute.name)
        })

        sanitizeNode(element)
      }

      child = next
    }
  }

  sanitizeNode(root)
  return root.innerHTML.trim()
}

export const toRenderableRichTextHtml = (value: string): string => {
  const raw = value.trim()
  if (!raw) {
    return ''
  }

  const html = isLikelyHtml(raw) ? raw : legacyTextToHtml(raw)
  return sanitizeRichTextHtml(html)
}

export const richTextToPlainText = (value: string): string => {
  const html = toRenderableRichTextHtml(value)
  if (!html) {
    return ''
  }

  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  }

  const parser = new DOMParser()
  const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html')
  const text = doc.body.textContent ?? ''
  return text.replace(/\s+/g, ' ').trim()
}
