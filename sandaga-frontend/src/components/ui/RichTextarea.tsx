import type {
  ChangeEvent,
  ClipboardEventHandler,
  FocusEvent,
  FocusEventHandler,
  TextareaHTMLAttributes
} from 'react'
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { useI18n } from '../../contexts/I18nContext'
import { richTextToPlainText, sanitizeRichTextHtml, toRenderableRichTextHtml } from '../../utils/richText'

type RichTextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>

export const RichTextarea = forwardRef<HTMLTextAreaElement, RichTextareaProps>(
  ({ className = '', ...textareaProps }, ref) => {
    const { t } = useI18n()
    const internalRef = useRef<HTMLTextAreaElement | null>(null)
    const editorRef = useRef<HTMLDivElement | null>(null)
    const lastSyncedValueRef = useRef<string>('')

    useImperativeHandle(ref, () => internalRef.current as HTMLTextAreaElement)

    const syncEditorFromValue = (rawValue: string) => {
      const editor = editorRef.current
      if (!editor) return

      const nextHtml = toRenderableRichTextHtml(rawValue)
      if (editor.innerHTML !== nextHtml) {
        editor.innerHTML = nextHtml
      }
      lastSyncedValueRef.current = nextHtml
      if (internalRef.current) {
        internalRef.current.value = nextHtml
      }
    }

    useEffect(() => {
      if (typeof textareaProps.value === 'string') {
        syncEditorFromValue(textareaProps.value)
      }
    }, [textareaProps.value])

    useEffect(() => {
      if (typeof textareaProps.defaultValue === 'string' && textareaProps.value === undefined) {
        syncEditorFromValue(textareaProps.defaultValue)
      }
    }, [])

    const emitChange = (nextValue: string) => {
      const textarea = internalRef.current
      if (textarea) {
        textarea.value = nextValue
      }
      if (typeof textareaProps.onChange === 'function') {
        textareaProps.onChange({
          target: {
            name: textareaProps.name,
            value: nextValue
          },
          currentTarget: {
            name: textareaProps.name,
            value: nextValue
          }
        } as unknown as ChangeEvent<HTMLTextAreaElement>)
      }
    }

    const syncFromEditor = () => {
      const editor = editorRef.current
      if (!editor) return

      const sanitizedHtml = sanitizeRichTextHtml(editor.innerHTML)
      const plain = richTextToPlainText(sanitizedHtml)
      const nextValue = plain ? sanitizedHtml : ''

      if (editor.innerHTML !== nextValue) {
        editor.innerHTML = nextValue
      }

      if (lastSyncedValueRef.current !== nextValue) {
        lastSyncedValueRef.current = nextValue
        emitChange(nextValue)
      }
    }

    const applyCommand = (command: string, value?: string) => {
      const editor = editorRef.current
      if (!editor) return

      editor.focus()
      document.execCommand(command, false, value)
      syncFromEditor()
    }

    const clearFormatting = () => {
      const editor = editorRef.current
      if (!editor) return
      editor.focus()
      document.execCommand('removeFormat')
      document.execCommand('formatBlock', false, 'p')
      syncFromEditor()
    }

    const onPastePlainText: ClipboardEventHandler<HTMLDivElement> = event => {
      const text = event.clipboardData.getData('text/plain')
      if (!text) return
      event.preventDefault()
      document.execCommand('insertText', false, text)
      syncFromEditor()
    }

    const onEditorBlur: FocusEventHandler<HTMLDivElement> = () => {
      if (typeof textareaProps.onBlur !== 'function') {
        return
      }

      const currentValue = internalRef.current?.value ?? ''
      textareaProps.onBlur({
        target: {
          name: textareaProps.name,
          value: currentValue
        },
        currentTarget: {
          name: textareaProps.name,
          value: currentValue
        }
      } as unknown as FocusEvent<HTMLTextAreaElement>)
    }

    return (
      <div className="rich-textarea">
        <div
          className="rich-textarea__toolbar"
          role="group"
          aria-label={t('richTextarea.toolbar')}
        >
          <button
            type="button"
            className="rich-textarea__button"
            onClick={() => applyCommand('bold')}
            aria-label={t('richTextarea.format.bold')}
          >
            B
          </button>
          <button
            type="button"
            className="rich-textarea__button"
            onClick={() => applyCommand('italic')}
            aria-label={t('richTextarea.format.italic')}
          >
            I
          </button>
          <button
            type="button"
            className="rich-textarea__button"
            onClick={() => applyCommand('underline')}
            aria-label={t('richTextarea.format.underline')}
          >
            U
          </button>
          <button
            type="button"
            className="rich-textarea__button"
            onClick={() => applyCommand('insertUnorderedList')}
            aria-label={t('richTextarea.list')}
          >
            •
          </button>
          <button
            type="button"
            className="rich-textarea__button"
            onClick={() => applyCommand('insertOrderedList')}
            aria-label={t('richTextarea.list')}
          >
            1.
          </button>
          <button
            type="button"
            className="rich-textarea__button"
            onClick={() => applyCommand('formatBlock', 'blockquote')}
            aria-label={t('richTextarea.quote')}
          >
            “”
          </button>
          <button
            type="button"
            className="rich-textarea__button"
            onClick={clearFormatting}
            aria-label={t('richTextarea.toolbar')}
          >
            Tx
          </button>
        </div>
        <div
          ref={editorRef}
          id={textareaProps.id}
          className={`rich-textarea__input ${className}`}
          contentEditable
          role="textbox"
          aria-multiline="true"
          aria-label={textareaProps['aria-label']}
          data-placeholder={textareaProps.placeholder}
          onInput={syncFromEditor}
          onBlur={onEditorBlur}
          onPaste={onPastePlainText}
          suppressContentEditableWarning
        />
        <textarea
          ref={node => {
            internalRef.current = node
            if (typeof ref === 'function') {
              ref(node)
            } else if (ref) {
              ref.current = node
            }
          }}
          className="rich-textarea__native"
          {...textareaProps}
          tabIndex={-1}
          aria-hidden="true"
        />
      </div>
    )
  }
)

RichTextarea.displayName = 'RichTextarea'
