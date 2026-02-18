import { forwardRef, useImperativeHandle, useRef } from 'react'
import { useI18n } from '../../contexts/I18nContext'

type RichTextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>

type FormatToken = {
  label: string
  prefix: string
  suffix?: string
  aria: string
}

export const RichTextarea = forwardRef<HTMLTextAreaElement, RichTextareaProps>(
  ({ className = '', ...textareaProps }, ref) => {
    const { t } = useI18n()
    const internalRef = useRef<HTMLTextAreaElement | null>(null)
    const tokens: FormatToken[] = [
      { label: 'B', prefix: '**', aria: t('richTextarea.format.bold') },
      { label: 'I', prefix: '*', aria: t('richTextarea.format.italic') },
      { label: 'U', prefix: '__', aria: t('richTextarea.format.underline') }
    ]

    useImperativeHandle(ref, () => internalRef.current as HTMLTextAreaElement)

    const applyToken = (token: FormatToken) => {
      const textarea = internalRef.current
      if (!textarea) return

      const { selectionStart, selectionEnd, value } = textarea
      const selected =
        selectionStart !== selectionEnd
          ? value.slice(selectionStart, selectionEnd)
          : t('richTextarea.selection.default')
      const formatted = `${token.prefix}${selected}${token.suffix ?? token.prefix}`
      const nextValue = value.slice(0, selectionStart) + formatted + value.slice(selectionEnd)
      const cursor = selectionStart + formatted.length

      updateValue(textarea, nextValue, cursor)
    }

    const applyList = () => {
      const textarea = internalRef.current
      if (!textarea) return

      const { selectionStart, selectionEnd, value } = textarea
      const before = value.slice(0, selectionStart)
      const selected = value.slice(selectionStart, selectionEnd)
      const after = value.slice(selectionEnd)

      const lines = (selected || t('richTextarea.list.defaultItem')).split(/\r?\n/)
      const formatted = lines.map(line => (line.trim().startsWith('- ') ? line : `- ${line.trim()}`)).join('\n')
      const nextValue = `${before}${formatted}${after}`
      const cursor = before.length + formatted.length

      updateValue(textarea, nextValue, cursor)
    }

    const applyQuote = () => {
      const textarea = internalRef.current
      if (!textarea) return

      const { selectionStart, selectionEnd, value } = textarea
      const before = value.slice(0, selectionStart)
      const selected =
        value.slice(selectionStart, selectionEnd) || t('richTextarea.quote.default')
      const after = value.slice(selectionEnd)
      const formatted = selected
        .split(/\r?\n/)
        .map(line => (line.trim().startsWith('> ') ? line : `> ${line}`))
        .join('\n')
      const nextValue = `${before}${formatted}${after}`
      const cursor = before.length + formatted.length

      updateValue(textarea, nextValue, cursor)
    }

    const updateValue = (textarea: HTMLTextAreaElement, nextValue: string, cursor: number) => {
      textarea.focus()
      textarea.value = nextValue
      textarea.setSelectionRange(cursor, cursor)
      textarea.dispatchEvent(new Event('input', { bubbles: true }))
    }

    return (
      <div className="rich-textarea">
        <div
          className="rich-textarea__toolbar"
          role="group"
          aria-label={t('richTextarea.toolbar')}
        >
          {tokens.map(token => (
            <button
              key={token.label}
              type="button"
              className="rich-textarea__button"
              onClick={() => applyToken(token)}
              aria-label={token.aria}
            >
              {token.label}
            </button>
          ))}
          <button
            type="button"
            className="rich-textarea__button"
            onClick={applyList}
            aria-label={t('richTextarea.list')}
          >
            ••
          </button>
          <button
            type="button"
            className="rich-textarea__button"
            onClick={applyQuote}
            aria-label={t('richTextarea.quote')}
          >
            “”
          </button>
        </div>
        <textarea
          ref={node => {
            internalRef.current = node
            if (typeof ref === 'function') {
              ref(node)
            } else if (ref) {
              ref.current = node
            }
          }}
          className={`rich-textarea__input ${className}`}
          {...textareaProps}
        />
      </div>
    )
  }
)

RichTextarea.displayName = 'RichTextarea'
