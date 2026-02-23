import { describe, expect, it } from 'vitest'
import { richTextToPlainText, toRenderableRichTextHtml } from './richText'

describe('richText utils', () => {
  it('converts legacy markdown-like content to rich html', () => {
    const html = toRenderableRichTextHtml('Bonjour **monde**\n- point')
    expect(html).toContain('<strong>monde</strong>')
    expect(html).toContain('<ul>')
    expect(html).toContain('<li>point</li>')
  })

  it('sanitizes unsafe tags', () => {
    const html = toRenderableRichTextHtml('<script>alert(1)</script><p>Safe</p>')
    expect(html).not.toContain('<script>')
    expect(html).toContain('<p>Safe</p>')
  })

  it('extracts plain text from rich html', () => {
    const text = richTextToPlainText('<p>Bonjour <strong>toi</strong></p>')
    expect(text).toBe('Bonjour toi')
  })
})
