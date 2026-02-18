import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import AdminLayout from '../../layouts/AdminLayout'
import { Button } from '../../components/ui/Button'
import { FormField } from '../../components/ui/FormField'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { apiGet, apiPatch, apiPost } from '../../utils/api'
import { useToast } from '../../components/ui/Toast'
import type { Category } from '../../types/category'
import { useI18n } from '../../contexts/I18nContext'

const DEFAULT_CATEGORY = {
  name: '',
  slug: '',
  description: '',
  icon: '',
  parentId: '',
  isActive: true,
  extraFieldsJson: '[]'
}

export default function AddCategory() {
  const navigate = useNavigate()
  const { addToast } = useToast()
  const { t } = useI18n()
  const [searchParams] = useSearchParams()
  const categoryId = searchParams.get('id')

  const [state, setState] = useState(DEFAULT_CATEGORY)
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isEditing = Boolean(categoryId)

  useEffect(() => {
    let active = true
    setIsLoading(true)
    setError(null)

    apiGet<Category[]>('/categories')
      .then(data => {
        if (!active) return
        setCategories(data)
      })
      .catch(err => {
        console.error('Unable to load categories', err)
        if (!active) return
        setError(err instanceof Error ? err.message : t('admin.addCategory.loadError'))
      })
      .finally(() => {
        if (active) {
          setIsLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!categoryId) {
      setState(DEFAULT_CATEGORY)
      return
    }

    let active = true
    setIsLoading(true)
    apiGet<Category>(`/categories/${categoryId}`)
      .then(category => {
        if (!active) return
        setState({
          name: category.name,
          slug: category.slug,
          description: category.description ?? '',
          icon: category.icon ?? '',
          parentId: category.parentId ?? '',
          isActive: Boolean(category.isActive),
          extraFieldsJson: JSON.stringify(category.extraFields ?? [], null, 2)
        })
      })
      .catch(err => {
        console.error('Unable to load category', err)
        if (!active) return
        addToast({
          variant: 'error',
          title: t('admin.addCategory.toast.errorTitle'),
          message: err instanceof Error ? err.message : t('admin.addCategory.notFound')
        })
      })
      .finally(() => {
        if (active) {
          setIsLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [addToast, categoryId])

  const categoryOptions = useMemo(
    () => [
      { value: '', label: t('admin.addCategory.parentNone') },
      ...categories.filter(category => category.id !== categoryId).map(category => ({
        value: category.id,
        label: category.name
      }))
    ],
    [categories, categoryId, t]
  )

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    let parsedExtraFields: unknown = []
    const trimmedExtraFields = state.extraFieldsJson.trim()
    if (trimmedExtraFields) {
      try {
        parsedExtraFields = JSON.parse(trimmedExtraFields)
      } catch {
        setError('Le JSON de extraFields est invalide.')
        return
      }
    }

    const payload = {
      name: state.name.trim(),
      slug: state.slug.trim(),
      description: state.description.trim() || null,
      icon: state.icon.trim() || null,
      parentId: state.parentId || undefined,
      isActive: state.isActive,
      extraFields: parsedExtraFields
    }

    if (!payload.name || !payload.slug) {
      setError(t('admin.addCategory.requiredError'))
      return
    }

    try {
      if (isEditing && categoryId) {
        await apiPatch(`/categories/${categoryId}`, payload)
        addToast({
          variant: 'success',
          title: t('admin.addCategory.toast.updatedTitle'),
          message: t('admin.addCategory.toast.updatedMessage')
        })
      } else {
        await apiPost('/categories', payload)
        addToast({
          variant: 'success',
          title: t('admin.addCategory.toast.createdTitle'),
          message: t('admin.addCategory.toast.createdMessage')
        })
      }
      navigate('/admin/categories')
    } catch (err) {
      console.error('Unable to save category', err)
      const message = err instanceof Error ? err.message : t('admin.addCategory.saveError')
      setError(message)
      addToast({ variant: 'error', title: t('admin.addCategory.toast.errorTitle'), message })
    }
  }

  return (
    <AdminLayout>
      <div className="admin-page">
        <header className="dashboard-header">
          <div>
            <h1>{isEditing ? t('admin.addCategory.editTitle') : t('admin.addCategory.createTitle')}</h1>
            <p>{t('admin.addCategory.subtitle')}</p>
          </div>
          <Button variant="outline" onClick={() => navigate('/admin/categories')}>
            {t('admin.addCategory.backToList')}
          </Button>
        </header>

        <form className="dashboard-section" onSubmit={handleSubmit}>
          <div className="dashboard-section__head">
            <h2>{t('admin.addCategory.sectionTitle')}</h2>
            <span>{t('admin.addCategory.sectionHint')}</span>
          </div>

          {error ? (
            <p className="auth-form__error" role="alert">
              {error}
            </p>
          ) : null}

          <FormField label={t('admin.addCategory.fields.name')} htmlFor="category-name" required>
            <Input
              id="category-name"
              value={state.name}
              onChange={event => setState(prev => ({ ...prev, name: event.target.value }))}
              placeholder={t('admin.addCategory.fields.namePlaceholder')}
              required
            />
          </FormField>

          <div className="listing-form__grid">
            <FormField label={t('admin.addCategory.fields.parent')} htmlFor="category-parent">
              <Select
                value={state.parentId}
                onChange={value => setState(prev => ({ ...prev, parentId: value as string }))}
                options={categoryOptions}
              />
            </FormField>
            <FormField
              label={t('admin.addCategory.fields.slug')}
              htmlFor="category-slug"
              required
              hint={t('admin.addCategory.fields.slugHint')}
            >
              <Input
                id="category-slug"
                value={state.slug}
                onChange={event => setState(prev => ({ ...prev, slug: event.target.value }))}
                placeholder={t('admin.addCategory.fields.slugPlaceholder')}
                required
              />
            </FormField>
          </div>

          <FormField label={t('admin.addCategory.fields.description')} htmlFor="category-description">
            <textarea
              id="category-description"
              className="input"
              rows={4}
              value={state.description}
              onChange={event => setState(prev => ({ ...prev, description: event.target.value }))}
              placeholder={t('admin.addCategory.fields.descriptionPlaceholder')}
            />
          </FormField>

          <FormField label={t('admin.addCategory.fields.icon')} htmlFor="category-icon">
            <Input
              id="category-icon"
              value={state.icon}
              onChange={event => setState(prev => ({ ...prev, icon: event.target.value }))}
              placeholder={t('admin.addCategory.fields.iconPlaceholder')}
            />
          </FormField>

          <FormField label="Categorie active">
            <label className="form-checkbox" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                checked={state.isActive}
                onChange={event => setState(prev => ({ ...prev, isActive: event.target.checked }))}
              />
              {state.isActive ? t('admin.categories.status.active') : t('admin.categories.status.inactive')}
            </label>
          </FormField>

          <FormField
            label={t('admin.addCategory.fields.extraFields')}
            hint="JSON libre: droits, ad_types, channel, etc."
            htmlFor="category-extra-fields-json"
          >
            <textarea
              id="category-extra-fields-json"
              className="input"
              rows={8}
              value={state.extraFieldsJson}
              onChange={event => setState(prev => ({ ...prev, extraFieldsJson: event.target.value }))}
              placeholder='{"rights":{"private":{"sell":true},"pro":{"sell":true}},"ad_types":{"sell":{"label":"Offre"}}}'
            />
          </FormField>

          <div className="auth-form__actions" style={{ justifyContent: 'flex-end' }}>
            <Button
              type="button"
              variant="ghost"
              onClick={() => navigate('/admin/categories')}
              disabled={isLoading}
            >
              {t('actions.cancel')}
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isEditing
                ? t('admin.addCategory.submitEdit')
                : t('admin.addCategory.submitCreate')}
            </Button>
          </div>
        </form>
      </div>
    </AdminLayout>
  )
}
