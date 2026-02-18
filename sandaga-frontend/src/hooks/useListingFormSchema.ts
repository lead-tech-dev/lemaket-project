import { useEffect, useMemo, useState } from 'react'
import { apiGet } from '../utils/api'
import { useI18n } from '../contexts/I18nContext'

// DTO retourné par le backend
export type FormSchemaDTO = {
  categoryId: string
  subCategoryId: string | null
  flow: 'sell' | 'buy' | 'let' | 'rent' | null
  adTypes?: Record<string, { label?: string; description?: string }>
  steps: Array<{
    id: string
    name: string
    label: string
    order: number
    info?: string[]
    created_at?: string
    updatedAt?: string
    flow?: string | null
    fields: Array<{
      id: string
      name: string
      label: string
      type: string
      unit?: string | null
      info?: string[]
      description?: string | null
      hint?: string | null
      required?: boolean
      minLength?: number | null
      maxLength?: number | null
      min?: number | null
      max?: number | null
      rows?: number | null
      placeholder?: string | null
      multiSelect?: boolean
      defaultValue?: any
      withCustomValue?: boolean
      rules?: {
        mandatory?: boolean
        max_length?: number
        min_length?: number
        min?: number
        max?: number
        regexp?: string
        err_mandatory?: string
        err_regexp?: string
      }
      options?: Array<{ value: string; label: string }>
      optionGroups?: Array<{ label: string; options: Array<{ value: string; label: string }> }>
      dependsOn?: string
      conditionalOptions?: Record<string, Array<{ value: string; label: string }>>
      ui?: {
        placeholder?: string
        disabledUntilDependsOnFilled?: boolean
      }
    }>
  }>
}

type UseListingFormSchemaResult = {
  schema: FormSchemaDTO | null
  isLoading: boolean
  error: string | null
  refresh: () => void
}

export function useListingFormSchema(categoryId: string | null): UseListingFormSchemaResult {
  const { t } = useI18n()
  const [schema, setSchema] = useState<FormSchemaDTO | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    if (!categoryId) {
      setSchema(null)
      return
    }

    let isMounted = true
    const controller = new AbortController()

    setIsLoading(true)
    setError(null)

    apiGet<FormSchemaDTO>(`/listings/form-schema/${categoryId}`, { signal: controller.signal })
      .then(payload => {
        if (!isMounted) return
        console.log(payload)
        setSchema(payload)
      })
      .catch(err => {
        if (!isMounted) return
        setError(
          err instanceof Error
            ? err.message
            : t('listings.formSchema.loadError')
        )
      })
      .finally(() => {
        if (!isMounted) return
        setIsLoading(false)
      })

    return () => {
      isMounted = false
      controller.abort()
    }
  }, [categoryId, nonce])

  const refresh = useMemo(() => {
    return () => setNonce(value => value + 1)
  }, [])

  return { schema, isLoading, error, refresh }
}
