import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import AdminLayout from '../../layouts/AdminLayout'
import { Button } from '../../components/ui/Button'
import { useToast } from '../../components/ui/Toast'
import { useI18n } from '../../contexts/I18nContext'
import {
  deleteSearchSynonym,
  fetchSearchRelevanceSettings,
  fetchSearchSynonyms,
  updateSearchRelevanceSettings,
  upsertSearchSynonym
} from '../../utils/admin-api'
import type { SearchRelevanceSettings, SearchSynonymEntry } from '../../types/admin'

type SynonymDraft = {
  term: string
  synonym: string
  isActive: boolean
}

const DEFAULT_SETTINGS: SearchRelevanceSettings = {
  enableBusinessBoost: true,
  enableDynamicSynonyms: true,
  popularCityBoost: 20,
  proSellerBoost: 10,
  categoryPriorityWeights: {},
  categoryWeightsText: ''
}

const DEFAULT_SYNONYM_DRAFT: SynonymDraft = {
  term: '',
  synonym: '',
  isActive: true
}

export default function SearchRelevance() {
  const { addToast } = useToast()
  const { t } = useI18n()
  const [isLoading, setIsLoading] = useState(true)
  const [isSavingSettings, setIsSavingSettings] = useState(false)
  const [isSavingSynonym, setIsSavingSynonym] = useState(false)
  const [deletingSynonymId, setDeletingSynonymId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [settings, setSettings] = useState<SearchRelevanceSettings>(DEFAULT_SETTINGS)
  const [synonyms, setSynonyms] = useState<SearchSynonymEntry[]>([])
  const [synonymDraft, setSynonymDraft] = useState<SynonymDraft>(DEFAULT_SYNONYM_DRAFT)

  const sortedSynonyms = useMemo(
    () =>
      synonyms
        .slice()
        .sort((a, b) => a.normalizedTerm.localeCompare(b.normalizedTerm, 'fr')),
    [synonyms]
  )

  const loadData = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [settingsData, synonymsData] = await Promise.all([
        fetchSearchRelevanceSettings(),
        fetchSearchSynonyms()
      ])
      setSettings({
        ...DEFAULT_SETTINGS,
        ...settingsData
      })
      setSynonyms(synonymsData)
    } catch (err) {
      const message = err instanceof Error ? err.message : t('admin.searchRelevance.loadError')
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [t])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const handleSettingsSave = async () => {
    setIsSavingSettings(true)
    try {
      const payload: Partial<SearchRelevanceSettings> = {
        enableBusinessBoost: settings.enableBusinessBoost,
        enableDynamicSynonyms: settings.enableDynamicSynonyms,
        popularCityBoost: Number(settings.popularCityBoost) || 0,
        proSellerBoost: Number(settings.proSellerBoost) || 0,
        categoryWeightsText: settings.categoryWeightsText
      }
      const updated = await updateSearchRelevanceSettings(payload)
      setSettings({
        ...DEFAULT_SETTINGS,
        ...updated
      })
      addToast({
        variant: 'success',
        title: t('admin.searchRelevance.toast.settingsTitle'),
        message: t('admin.searchRelevance.toast.settingsSaved')
      })
    } catch (err) {
      addToast({
        variant: 'error',
        title: t('admin.searchRelevance.toast.settingsTitle'),
        message: err instanceof Error ? err.message : t('admin.searchRelevance.toast.settingsSaveError')
      })
    } finally {
      setIsSavingSettings(false)
    }
  }

  const handleSynonymSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!synonymDraft.term.trim() || !synonymDraft.synonym.trim()) {
      addToast({
        variant: 'error',
        title: t('admin.searchRelevance.toast.synonymTitle'),
        message: t('admin.searchRelevance.toast.synonymRequired')
      })
      return
    }

    setIsSavingSynonym(true)
    try {
      const saved = await upsertSearchSynonym({
        term: synonymDraft.term,
        synonym: synonymDraft.synonym,
        isActive: synonymDraft.isActive
      })
      setSynonyms(previous => {
        const withoutSaved = previous.filter(item => item.id !== saved.id)
        return [...withoutSaved, saved]
      })
      setSynonymDraft(DEFAULT_SYNONYM_DRAFT)
      addToast({
        variant: 'success',
        title: t('admin.searchRelevance.toast.synonymTitle'),
        message: t('admin.searchRelevance.toast.synonymSaved')
      })
    } catch (err) {
      addToast({
        variant: 'error',
        title: t('admin.searchRelevance.toast.synonymTitle'),
        message: err instanceof Error ? err.message : t('admin.searchRelevance.toast.synonymSaveError')
      })
    } finally {
      setIsSavingSynonym(false)
    }
  }

  const handleDeleteSynonym = async (id: string) => {
    setDeletingSynonymId(id)
    try {
      await deleteSearchSynonym(id)
      setSynonyms(previous => previous.filter(item => item.id !== id))
      addToast({
        variant: 'success',
        title: t('admin.searchRelevance.toast.synonymTitle'),
        message: t('admin.searchRelevance.toast.synonymDeleted')
      })
    } catch (err) {
      addToast({
        variant: 'error',
        title: t('admin.searchRelevance.toast.synonymTitle'),
        message: err instanceof Error ? err.message : t('admin.searchRelevance.toast.synonymDeleteError')
      })
    } finally {
      setDeletingSynonymId(null)
    }
  }

  return (
    <AdminLayout>
      <div className="admin-page">
        <header className="dashboard-header">
          <div>
            <h1>{t('admin.searchRelevance.title')}</h1>
            <p>{t('admin.searchRelevance.subtitle')}</p>
          </div>
          <div className="admin-filter-bar">
            <Button variant="ghost" onClick={() => void loadData()} disabled={isLoading}>
              {t('admin.searchRelevance.refresh')}
            </Button>
          </div>
        </header>

        {error ? (
          <p className="auth-form__error" role="alert">
            {error}
          </p>
        ) : null}

        <section className="admin-grid">
          <article className="admin-card">
            <h2>{t('admin.searchRelevance.relevance.title')}</h2>
            <div className="admin-monitoring-settings">
              <label className="admin-monitoring-settings__row">
                <span>
                  <strong>{t('admin.searchRelevance.relevance.businessBoost')}</strong>
                  <small className="admin-monitoring-muted">{t('admin.searchRelevance.relevance.businessBoostHint')}</small>
                </span>
                <input
                  type="checkbox"
                  checked={settings.enableBusinessBoost}
                  onChange={event =>
                    setSettings(previous => ({ ...previous, enableBusinessBoost: event.target.checked }))
                  }
                />
              </label>

              <label className="admin-monitoring-settings__row">
                <span>
                  <strong>{t('admin.searchRelevance.relevance.dynamicSynonyms')}</strong>
                  <small className="admin-monitoring-muted">{t('admin.searchRelevance.relevance.dynamicSynonymsHint')}</small>
                </span>
                <input
                  type="checkbox"
                  checked={settings.enableDynamicSynonyms}
                  onChange={event =>
                    setSettings(previous => ({ ...previous, enableDynamicSynonyms: event.target.checked }))
                  }
                />
              </label>

              <label className="admin-monitoring-settings__row">
                <span>
                  <strong>{t('admin.searchRelevance.relevance.cityBoost')}</strong>
                  <small className="admin-monitoring-muted">{t('admin.searchRelevance.relevance.cityBoostHint')}</small>
                </span>
                <input
                  type="number"
                  min={0}
                  max={200}
                  step={1}
                  value={settings.popularCityBoost}
                  onChange={event =>
                    setSettings(previous => ({ ...previous, popularCityBoost: Number(event.target.value) || 0 }))
                  }
                />
              </label>

              <label className="admin-monitoring-settings__row">
                <span>
                  <strong>{t('admin.searchRelevance.relevance.proBoost')}</strong>
                  <small className="admin-monitoring-muted">{t('admin.searchRelevance.relevance.proBoostHint')}</small>
                </span>
                <input
                  type="number"
                  min={0}
                  max={200}
                  step={1}
                  value={settings.proSellerBoost}
                  onChange={event =>
                    setSettings(previous => ({ ...previous, proSellerBoost: Number(event.target.value) || 0 }))
                  }
                />
              </label>

              <label className="admin-monitoring-settings__row admin-monitoring-settings__row--textarea">
                <span>
                  <strong>{t('admin.searchRelevance.relevance.categoryWeights')}</strong>
                  <small className="admin-monitoring-muted">
                    {t('admin.searchRelevance.relevance.categoryWeightsHint')}
                  </small>
                </span>
                <textarea
                  value={settings.categoryWeightsText}
                  onChange={event =>
                    setSettings(previous => ({ ...previous, categoryWeightsText: event.target.value }))
                  }
                  rows={4}
                />
              </label>

              <Button variant="accent" onClick={handleSettingsSave} disabled={isSavingSettings || isLoading}>
                {isSavingSettings ? t('admin.searchRelevance.relevance.saving') : t('admin.searchRelevance.relevance.save')}
              </Button>
            </div>
          </article>

          <article className="admin-card">
            <h2>{t('admin.searchRelevance.synonyms.title')}</h2>
            <form className="admin-search-synonym-form" onSubmit={handleSynonymSubmit}>
              <input
                type="text"
                placeholder={t('admin.searchRelevance.synonyms.termPlaceholder')}
                value={synonymDraft.term}
                onChange={event =>
                  setSynonymDraft(previous => ({ ...previous, term: event.target.value }))
                }
              />
              <input
                type="text"
                placeholder={t('admin.searchRelevance.synonyms.synonymPlaceholder')}
                value={synonymDraft.synonym}
                onChange={event =>
                  setSynonymDraft(previous => ({ ...previous, synonym: event.target.value }))
                }
              />
              <label className="admin-search-synonym-toggle">
                <input
                  type="checkbox"
                  checked={synonymDraft.isActive}
                  onChange={event =>
                    setSynonymDraft(previous => ({ ...previous, isActive: event.target.checked }))
                  }
                />
                <span>{t('admin.searchRelevance.synonyms.active')}</span>
              </label>
              <Button variant="outline" type="submit" disabled={isSavingSynonym || isLoading}>
                {isSavingSynonym ? t('admin.searchRelevance.synonyms.adding') : t('admin.searchRelevance.synonyms.add')}
              </Button>
            </form>

            {isLoading ? (
              <p className="admin-monitoring-muted">{t('admin.searchRelevance.synonyms.loading')}</p>
            ) : sortedSynonyms.length === 0 ? (
              <p className="admin-monitoring-muted">{t('admin.searchRelevance.synonyms.empty')}</p>
            ) : (
              <div className="admin-table-wrapper">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>{t('admin.searchRelevance.synonyms.colTerm')}</th>
                      <th>{t('admin.searchRelevance.synonyms.colSynonym')}</th>
                      <th>{t('admin.searchRelevance.synonyms.colStatus')}</th>
                      <th style={{ width: 120 }}>{t('admin.searchRelevance.synonyms.colAction')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedSynonyms.map(item => (
                      <tr key={item.id}>
                        <td>{item.term}</td>
                        <td>{item.synonym}</td>
                        <td>
                          <span className={`admin-status ${item.isActive ? 'admin-status--approved' : 'admin-status--neutral'}`}>
                            {item.isActive ? t('admin.searchRelevance.synonyms.active') : t('admin.searchRelevance.synonyms.inactive')}
                          </span>
                        </td>
                        <td>
                          <Button
                            variant="ghost"
                            onClick={() => void handleDeleteSynonym(item.id)}
                            disabled={deletingSynonymId === item.id}
                          >
                            {deletingSynonymId === item.id ? t('admin.searchRelevance.synonyms.deleting') : t('admin.searchRelevance.synonyms.delete')}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>
        </section>
      </div>
    </AdminLayout>
  )
}
