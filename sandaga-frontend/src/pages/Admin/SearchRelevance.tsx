import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import AdminLayout from '../../layouts/AdminLayout'
import { Button } from '../../components/ui/Button'
import { useToast } from '../../components/ui/Toast'
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
      const message = err instanceof Error ? err.message : 'Impossible de charger les réglages recherche.'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [])

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
        title: 'Recherche',
        message: 'Réglages de pertinence enregistrés.'
      })
    } catch (err) {
      addToast({
        variant: 'error',
        title: 'Recherche',
        message: err instanceof Error ? err.message : 'Échec de sauvegarde des réglages.'
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
        title: 'Synonymes',
        message: 'Le terme et le synonyme sont obligatoires.'
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
        title: 'Synonymes',
        message: 'Synonyme enregistré.'
      })
    } catch (err) {
      addToast({
        variant: 'error',
        title: 'Synonymes',
        message: err instanceof Error ? err.message : 'Impossible d’enregistrer le synonyme.'
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
        title: 'Synonymes',
        message: 'Synonyme supprimé.'
      })
    } catch (err) {
      addToast({
        variant: 'error',
        title: 'Synonymes',
        message: err instanceof Error ? err.message : 'Suppression impossible.'
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
            <h1>Recherche avancée</h1>
            <p>Ajuste les règles de pertinence et les synonymes utilisés par le moteur de recherche.</p>
          </div>
          <div className="admin-filter-bar">
            <Button variant="ghost" onClick={() => void loadData()} disabled={isLoading}>
              Actualiser
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
            <h2>Pertinence</h2>
            <div className="admin-monitoring-settings">
              <label className="admin-monitoring-settings__row">
                <span>
                  <strong>Activer les boosts business</strong>
                  <small className="admin-monitoring-muted">Pondère les annonces premium/pro dans le classement.</small>
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
                  <strong>Activer les synonymes dynamiques</strong>
                  <small className="admin-monitoring-muted">Utilise la table des synonymes admin dans la recherche.</small>
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
                  <strong>Boost villes populaires</strong>
                  <small className="admin-monitoring-muted">Poids appliqué aux zones majeures.</small>
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
                  <strong>Boost vendeurs pro</strong>
                  <small className="admin-monitoring-muted">Poids additionnel pour les vendeurs professionnels.</small>
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
                  <strong>Poids par catégorie</strong>
                  <small className="admin-monitoring-muted">
                    Format: `slug:poids` séparés par virgules. Exemple: `immobilier:30, vehicules:20`
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
                {isSavingSettings ? 'Enregistrement...' : 'Enregistrer'}
              </Button>
            </div>
          </article>

          <article className="admin-card">
            <h2>Synonymes</h2>
            <form className="admin-search-synonym-form" onSubmit={handleSynonymSubmit}>
              <input
                type="text"
                placeholder="Terme (ex: telephone)"
                value={synonymDraft.term}
                onChange={event =>
                  setSynonymDraft(previous => ({ ...previous, term: event.target.value }))
                }
              />
              <input
                type="text"
                placeholder="Synonyme (ex: gsm)"
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
                <span>Actif</span>
              </label>
              <Button variant="outline" type="submit" disabled={isSavingSynonym || isLoading}>
                {isSavingSynonym ? 'Ajout...' : 'Ajouter'}
              </Button>
            </form>

            {isLoading ? (
              <p className="admin-monitoring-muted">Chargement...</p>
            ) : sortedSynonyms.length === 0 ? (
              <p className="admin-monitoring-muted">Aucun synonyme configuré.</p>
            ) : (
              <div className="admin-table-wrapper">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Terme</th>
                      <th>Synonyme</th>
                      <th>Statut</th>
                      <th style={{ width: 120 }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedSynonyms.map(item => (
                      <tr key={item.id}>
                        <td>{item.term}</td>
                        <td>{item.synonym}</td>
                        <td>
                          <span className={`admin-status ${item.isActive ? 'admin-status--approved' : 'admin-status--neutral'}`}>
                            {item.isActive ? 'Actif' : 'Inactif'}
                          </span>
                        </td>
                        <td>
                          <Button
                            variant="ghost"
                            onClick={() => void handleDeleteSynonym(item.id)}
                            disabled={deletingSynonymId === item.id}
                          >
                            {deletingSynonymId === item.id ? 'Suppression...' : 'Supprimer'}
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
