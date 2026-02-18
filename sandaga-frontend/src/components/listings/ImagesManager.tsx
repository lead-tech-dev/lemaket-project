
import { ChangeEvent, DragEvent, useMemo, useState } from 'react'
import { Button } from '../ui/Button'
import { resolveMediaUrl, uploadMedia } from '../../utils/media'
import { useI18n } from '../../contexts/I18nContext'

export type ListingImageFormItem = {
  id: string
  url: string | null
  name?: string
  key?: string
  isCover: boolean
  status: 'uploaded' | 'uploading' | 'error'
  errorMessage?: string
  file?: File
  progress?: number
}

type ImagesManagerProps = {
  value: ListingImageFormItem[]
  onChange: React.Dispatch<React.SetStateAction<ListingImageFormItem[]>>
  disabled?: boolean
  maxItems?: number
}

const MAX_ITEMS_DEFAULT = 8

function buildTempId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.round(Math.random() * 1e9)}`
}

export function ImagesManager({
  value,
  onChange,
  disabled = false,
  maxItems = MAX_ITEMS_DEFAULT
}: ImagesManagerProps) {
  const { t } = useI18n()
  const [isDragging, setIsDragging] = useState(false)
  const remainingSlots = useMemo(() => Math.max(0, maxItems - value.length), [maxItems, value.length])

  const hasCover = useMemo(() => value.some(image => image.isCover && image.status === 'uploaded'), [value])

  const addOrUpdate = (updater: (prev: ListingImageFormItem[]) => ListingImageFormItem[]) => {
    onChange(prev => updater([...prev]))
  }

  const moveImage = (id: string, direction: -1 | 1) => {
    addOrUpdate(prev => {
      const currentIndex = prev.findIndex(item => item.id === id)
      const targetIndex = currentIndex + direction
      if (currentIndex === -1 || targetIndex < 0 || targetIndex >= prev.length) {
        return prev
      }
      const next = [...prev]
      const [removed] = next.splice(currentIndex, 1)
      next.splice(targetIndex, 0, removed)
      return next
    })
  }

  const handleFilesList = (files: FileList | File[]) => {
    if (!files?.length || remainingSlots === 0) {
      return
    }

    const filesToUpload = Array.from(files).slice(0, remainingSlots)
    filesToUpload.forEach((file, index) => {
      const tempId = buildTempId('file')
      const isFirst = !value.length && index === 0 && !hasCover

      addOrUpdate(prev => {
        const next = [
          ...prev,
          {
            id: tempId,
            url: null,
            name: file.name,
            isCover: hasCover ? false : (prev.length === 0 && index === 0) || isFirst,
            status: 'uploading' as const,
            file,
            progress: 0
          }
        ]
        return next
      })

      void processFileUpload(tempId, file)
    })
  }

  const handleFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files?.length) {
      return
    }

    handleFilesList(files)
    event.target.value = ''
  }

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault()
    if (disabled || remainingSlots === 0) {
      return
    }
    setIsDragging(false)
    if (event.dataTransfer?.files?.length) {
      handleFilesList(event.dataTransfer.files)
    }
  }

  const handleDragOver = (event: DragEvent<HTMLLabelElement>) => {
    if (disabled || remainingSlots === 0) {
      return
    }
    event.preventDefault()
  }

  const handleDragEnter = (event: DragEvent<HTMLLabelElement>) => {
    if (disabled || remainingSlots === 0) {
      return
    }
    event.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const processFileUpload = async (id: string, file: File) => {
    const previewUrl = URL.createObjectURL(file)
    addOrUpdate(prev => {
      const idx = prev.findIndex(item => item.id === id)
      if (idx === -1) {
        return prev
      }
      const next = [...prev]
      next[idx] = {
        ...next[idx],
        url: previewUrl,
        file,
        status: 'uploading' as const,
        errorMessage: undefined,
        progress: 0
      }
      return next
    })
    await uploadFile(id, file)
  }

  const uploadFile = async (id: string, file: File) => {
    try {
      const result = await uploadMedia(
        file,
        progress => {
          addOrUpdate(prev => {
            const idx = prev.findIndex(item => item.id === id)
            if (idx === -1) {
              return prev
            }
            const next = [...prev]
            next[idx] = {
              ...next[idx],
              progress,
              status: 'uploading' as const
            }
            return next
          })
        },
        {
          invalidResponse: t('imagesManager.errors.invalidResponse'),
          networkError: t('imagesManager.errors.network')
        }
      )
      addOrUpdate(prev => {
        const idx = prev.findIndex(item => item.id === id)
        if (idx === -1) {
          return prev
        }
        const otherHasCover = prev.some((item, index) => index !== idx && item.isCover && item.status === 'uploaded')
        const next = [...prev]
        next[idx] = {
          id,
          url: resolveMediaUrl(result.url),
          name: result.originalName ?? file.name,
          key: result.key,
          isCover: prev[idx].isCover || !otherHasCover,
          status: 'uploaded' as const,
          progress: 100
        }
        return next
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : t('imagesManager.errors.uploadFailed')
      addOrUpdate(prev => {
        const idx = prev.findIndex(item => item.id === id)
        if (idx === -1) {
          return prev
        }
        const next = [...prev]
        next[idx] = {
          ...next[idx],
          status: 'error' as const,
          errorMessage: message,
          progress: 0
        }
        return next
      })
    }
  }

  const setCover = (id: string) => {
    addOrUpdate(prev => prev.map(item => ({ ...item, isCover: item.id === id })))
  }

  const removeImage = (id: string) => {
    addOrUpdate(prev => {
      const filtered = prev.filter(item => item.id !== id)
      if (filtered.length && !filtered.some(item => item.isCover && item.status === 'uploaded')) {
        filtered[0] = { ...filtered[0], isCover: true }
      }
      return filtered
    })
  }

  const retryUpload = (id: string) => {
    const item = value.find(image => image.id === id)
    if (!item?.file) {
      return
    }
    addOrUpdate(prev =>
      prev.map(image =>
        image.id === id
          ? {
              ...image,
              status: 'uploading' as const,
              errorMessage: undefined,
              progress: 0
            }
          : image
      )
    )
    void uploadFile(id, item.file)
  }

  return (
    <div className="images-manager">
      <div className="images-manager__controls">
        <div className="images-manager__uploader">
          <input
            id="images-manager-file"
            className="images-manager__file-input"
            type="file"
            accept="image/*"
            multiple
            onChange={handleFiles}
            disabled={disabled || remainingSlots === 0}
          />
          <label
            htmlFor="images-manager-file"
            className={`images-manager__file-card${disabled || remainingSlots === 0 ? ' is-disabled' : ''}${isDragging ? ' is-dragging' : ''}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
          >
            <span className="images-manager__file-icon" aria-hidden="true">
              +
            </span>
            <span className="images-manager__file-text">
              <span className="images-manager__file-title">{t('imagesManager.addImages')}</span>
              <span className="images-manager__file-hint">
                {t('imagesManager.addImagesHint', { count: remainingSlots })}
              </span>
              {isDragging ? (
                <span className="images-manager__file-drop-hint">
                  {t('imagesManager.dropHint')}
                </span>
              ) : null}
            </span>
          </label>
        </div>

      </div>

      {value.length ? (
        <ul className="images-manager__list">
          {value.map((item, index) => {
            const displayName = t('imagesManager.photoLabel', { index: index + 1 })
            return (
              <li key={item.id} className="images-manager__item">
                <div className="images-manager__preview">
                {item.url ? (
                  <img
                    src={item.url}
                    alt={displayName}
                  />
                ) : (
                  <span
                    className="images-manager__preview-placeholder"
                  >
                    {item.status === 'uploading'
                      ? t('imagesManager.status.uploading')
                      : t('imagesManager.status.pending')}
                  </span>
                )}
                {item.isCover ? (
                  <span className="images-manager__cover-badge">
                    {t('imagesManager.coverBadge')}
                  </span>
                ) : null}
                {item.status === 'uploading' ? (
                  <div className="images-manager__progress">
                    <div
                      className="images-manager__progress-bar"
                      style={{ width: `${item.progress ?? 10}%` }}
                    />
                  </div>
                ) : null}
                </div>

                <div className="images-manager__meta">
                  <strong className="images-manager__title">{displayName}</strong>
                  <span className="images-manager__status">
                    {item.status === 'uploaded'
                      ? t('imagesManager.status.online')
                      : item.status === 'uploading'
                      ? t('imagesManager.status.uploadingFull')
                      : item.errorMessage ?? t('imagesManager.status.error')}
                  </span>
                </div>

                <div className="images-manager__actions">
                  <div className="images-manager__move">
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={disabled || value[0]?.id === item.id}
                      onClick={() => moveImage(item.id, -1)}
                    >
                      ↑
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={disabled || value[value.length - 1]?.id === item.id}
                      onClick={() => moveImage(item.id, 1)}
                    >
                      ↓
                    </Button>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={disabled || item.status !== 'uploaded' || item.isCover}
                    onClick={() => setCover(item.id)}
                  >
                    {t('imagesManager.setCover')}
                  </Button>
                  {item.status === 'error' && item.file ? (
                    <Button type="button" variant="outline" onClick={() => retryUpload(item.id)} disabled={disabled}>
                      {t('actions.retry')}
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => removeImage(item.id)}
                    disabled={disabled || item.status === 'uploading'}
                  >
                    {t('actions.delete')}
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="images-manager__empty">
          {t('imagesManager.empty')}
        </p>
      )}
    </div>
  )
}
