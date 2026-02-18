import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import AdminLayout from '../../layouts/AdminLayout'
import { Button } from '../../components/ui/Button'
import { FormField } from '../../components/ui/FormField'
import { useToast } from '../../components/ui/Toast'
import { Skeleton } from '../../components/ui/Skeleton'
import { RetryBanner } from '../../components/ui/RetryBanner'
import { EmptyState } from '../../components/ui/EmptyState'
import { useUnsavedChangesPrompt } from '../../hooks/useUnsavedChangesPrompt'
import { useI18n } from '../../contexts/I18nContext'
import { fetchAdminSettings, updateAdminSettingsBatch, type AdminSettingResponse } from '../../utils/admin-api'

type SettingsByGroup = Record<string, AdminSettingResponse[]>

type DraftState = Record<string, unknown>
type InputState = Record<string, string>
type ErrorState = Record<string, string | null>

export default function Settings() {
  const [settings, setSettings] = useState<AdminSettingResponse[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [draftValues, setDraftValues] = useState<DraftState>({})
  const [inputValues, setInputValues] = useState<InputState>({})
  const [errors, setErrors] = useState<ErrorState>({})
  const [isSaving, setIsSaving] = useState(false)
  const { addToast } = useToast()
  const isMountedRef = useRef(true)
  const { t } = useI18n()

  const loadSettings = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await fetchAdminSettings()
      if (!isMountedRef.current) {
        return data
      }
      setSettings(data)
      return data
    } catch (err) {
      if (!isMountedRef.current) {
        throw err
      }
      console.error('Unable to load admin settings', err)
      const fallbackMessage = t('admin.settings.loadError')
      const resolvedMessage = err instanceof Error ? err.message : fallbackMessage
      setError(resolvedMessage)
      addToast({ variant: 'error', title: fallbackMessage, message: resolvedMessage })
      throw err
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false)
      }
    }
  }, [addToast, t])

  useEffect(() => {
    loadSettings().catch(() => {
      /* handled in loadSettings */
    })
  }, [loadSettings])

  useEffect(() => {
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const groupedSettings: SettingsByGroup = useMemo(() => {
    return settings.reduce<SettingsByGroup>((acc, setting) => {
      if (!acc[setting.group]) {
        acc[setting.group] = []
      }
      acc[setting.group].push(setting)
      return acc
    }, {})
  }, [settings])

  const dirtyKeys = useMemo(() => Object.keys(draftValues), [draftValues])
  const hasErrors = useMemo(
    () => Object.values(errors).some(message => Boolean(message)),
    [errors]
  )
  const hasUnsavedChanges = useMemo(
    () => Boolean(dirtyKeys.length || Object.keys(inputValues).length),
    [dirtyKeys, inputValues]
  )

  useUnsavedChangesPrompt(hasUnsavedChanges)

  const normalizeNumber = (value: unknown): number | null => {
    const numeric = Number(value)
    return Number.isFinite(numeric) ? numeric : null
  }

  const handleBooleanChange = (setting: AdminSettingResponse, checked: boolean) => {
    const original = Boolean(setting.value)
    setDraftValues(prev => {
      const next = { ...prev }
      if (checked === original) {
        delete next[setting.key]
      } else {
        next[setting.key] = checked
      }
      return next
    })
    setErrors(prev => {
      const next = { ...prev }
      delete next[setting.key]
      return next
    })
  }

  const updateInputValue = (key: string, value?: string) => {
    setInputValues(prev => {
      const next = { ...prev }
      if (value === undefined) {
        delete next[key]
      } else {
        next[key] = value
      }
      return next
    })
  }

  const handleNumberChange = (setting: AdminSettingResponse, raw: string) => {
    updateInputValue(setting.key, raw)

    if (!raw.trim()) {
      setErrors(prev => ({ ...prev, [setting.key]: t('admin.settings.validation.required') }))
      setDraftValues(prev => {
        const next = { ...prev }
        delete next[setting.key]
        return next
      })
      return
    }

    const numeric = normalizeNumber(raw)
    if (numeric === null) {
      setErrors(prev => ({ ...prev, [setting.key]: t('admin.settings.validation.number') }))
      setDraftValues(prev => {
        const next = { ...prev }
        delete next[setting.key]
        return next
      })
      return
    }

    if (setting.min !== undefined && numeric < setting.min) {
      setErrors(prev => ({
        ...prev,
        [setting.key]: t('admin.settings.validation.min', { min: setting.min ?? 0 })
      }))
      setDraftValues(prev => {
        const next = { ...prev }
        delete next[setting.key]
        return next
      })
      return
    }

    if (setting.max !== undefined && numeric > setting.max) {
      setErrors(prev => ({
        ...prev,
        [setting.key]: t('admin.settings.validation.max', { max: setting.max ?? 0 })
      }))
      setDraftValues(prev => {
        const next = { ...prev }
        delete next[setting.key]
        return next
      })
      return
    }

    const originalNumeric = normalizeNumber(setting.value)
    setErrors(prev => {
      const next = { ...prev }
      delete next[setting.key]
      return next
    })
    setDraftValues(prev => {
      const next = { ...prev }
      if (numeric === originalNumeric) {
        delete next[setting.key]
        updateInputValue(setting.key, undefined)
      } else {
        next[setting.key] = numeric
        updateInputValue(setting.key, raw)
      }
      return next
    })
  }

  const handleTextChange = (setting: AdminSettingResponse, raw: string) => {
    const original = setting.value === undefined || setting.value === null ? '' : String(setting.value)
    const trimmed = raw
    setErrors(prev => {
      const next = { ...prev }
      delete next[setting.key]
      return next
    })
    setDraftValues(prev => {
      const next = { ...prev }
      if (trimmed === original) {
        delete next[setting.key]
        updateInputValue(setting.key, undefined)
      } else {
        next[setting.key] = trimmed
        updateInputValue(setting.key, raw)
      }
      return next
    })
  }

  const getCurrentValue = (setting: AdminSettingResponse) => {
    if (setting.type === 'boolean') {
      if (setting.key in draftValues) {
        return Boolean(draftValues[setting.key])
      }
      return Boolean(setting.value)
    }

    if (setting.key in inputValues) {
      return inputValues[setting.key]
    }

    const source =
      setting.key in draftValues ? draftValues[setting.key] : setting.value
    if (source === null || source === undefined) {
      return ''
    }
    return String(source)
  }

  const handleSave = useCallback(async () => {
    if (!dirtyKeys.length || hasErrors) {
      return
    }
    setIsSaving(true)
    try {
      const payload = dirtyKeys.map(key => ({ key, value: draftValues[key] }))
      const response = await updateAdminSettingsBatch(payload)
      const resultMap = new Map(response.map(item => [item.key, item.value]))
      setSettings(prev =>
        prev.map(setting =>
          resultMap.has(setting.key)
            ? { ...setting, value: resultMap.get(setting.key) }
            : setting
        )
      )
      setDraftValues({})
      setInputValues({})
      setErrors(prev => {
        const next = { ...prev }
        dirtyKeys.forEach(key => {
          delete next[key]
        })
        return next
      })
      addToast({
        variant: 'success',
        title: t('admin.settings.saveTitle'),
        message: t('admin.settings.saveSuccess')
      })
    } catch (err) {
      console.error('Unable to update settings', err)
      addToast({
        variant: 'error',
        title: t('admin.settings.toast.saveErrorTitle'),
        message:
          err instanceof Error
            ? err.message
            : t('admin.settings.saveError')
      })
    } finally {
      setIsSaving(false)
    }
  }, [dirtyKeys, hasErrors, draftValues, addToast, t])

  const handleReset = () => {
    setDraftValues({})
    setInputValues({})
    setErrors({})
  }

  return (
    <AdminLayout>
      <div className="admin-page">
        <header className="dashboard-header">
          <div>
            <h1>{t('admin.settings.title')}</h1>
            <p>{t('admin.settings.subtitle')}</p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button variant="ghost" onClick={handleReset} disabled={!hasUnsavedChanges}>
              {t('admin.settings.reset')}
            </Button>
            <Button onClick={handleSave} disabled={!hasUnsavedChanges || hasErrors || isSaving}>
              {isSaving ? t('admin.settings.saving') : t('admin.settings.save')}
            </Button>
          </div>
        </header>

        {error ? (
          <RetryBanner
            title={t('admin.settings.loadError')}
            message={error}
            accessory="⚠️"
            onRetry={() => loadSettings().catch(() => undefined)}
          />
        ) : null}

        {isLoading && !settings.length ? (
          <div style={{ display: 'grid', gap: '24px' }} aria-hidden>
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} style={{ display: 'grid', gap: '12px' }}>
                <Skeleton width="220px" height="24px" />
                <Skeleton width="60%" height="16px" />
                <Skeleton height="44px" />
              </div>
            ))}
          </div>
        ) : null}

        {!isLoading && !error && !settings.length ? (
          <EmptyState
            icon="⚙️"
            title={t('empty.admin.settings.title')}
            description={t('empty.admin.settings.description')}
            action={
              <Button onClick={() => loadSettings().catch(() => undefined)}>
                {t('actions.refresh')}
              </Button>
            }
          />
        ) : null}

        {settings.length
          ? Object.keys(groupedSettings).map(group => (
              <section key={group} className="dashboard-section">
                <h2>{group}</h2>
                <div style={{ display: 'grid', gap: '16px' }}>
                  {groupedSettings[group].map(setting => {
                    const currentValue = getCurrentValue(setting)
                    const errorMessage = errors[setting.key] ?? null
                    return (
                      <FormField
                        key={setting.key}
                        label={setting.label}
                        hint={setting.description}
                        error={errorMessage || undefined}
                      >
                        {setting.type === 'boolean' ? (
                          <label className="form-field__control" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <input
                              type="checkbox"
                              checked={Boolean(currentValue)}
                              onChange={event => handleBooleanChange(setting, event.target.checked)}
                            />
                            <span>Activer</span>
                          </label>
                    ) : setting.type === 'number' ? (
                      <input
                        className="input"
                        type="number"
                        step={setting.step ?? 1}
                        min={setting.min}
                        max={setting.max}
                        value={
                          typeof currentValue === 'number' || typeof currentValue === 'string'
                            ? currentValue
                            : ''
                        }
                        onChange={event => handleNumberChange(setting, event.target.value)}
                        placeholder={setting.placeholder}
                      />
                    ) : (
                      <input
                        className="input"
                        value={typeof currentValue === 'string' ? currentValue : ''}
                        onChange={event => handleTextChange(setting, event.target.value)}
                        placeholder={setting.placeholder}
                      />
                    )}
                      </FormField>
                    )
                  })}
                </div>
              </section>
            ))
          : null}
      </div>
    </AdminLayout>
  )
}
