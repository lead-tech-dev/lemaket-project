import type { Category } from '../types/category'

type RawCategory = Category & {
  parent?: { id?: string | null }
  iconUrl?: string | null
  icon_url?: string | null
}

const NAME_LOCALE = 'fr'

/**
 * Ensures parent/children relationships are consistently flattened and sorted.
 */
export function normalizeCategories(categories: Category[]): Category[] {
  return categories
    .map(category => normalizeCategory(category))
    .sort((a, b) => {
      const positionDiff = (a.position ?? 0) - (b.position ?? 0)
      if (positionDiff !== 0) {
        return positionDiff
      }
      return a.name.localeCompare(b.name, NAME_LOCALE, { sensitivity: 'base' })
    })
}

export function normalizeCategory(category: Category): Category {
  const raw = category as RawCategory
  const parentId = raw.parentId ?? raw.parent?.id ?? null
  const resolveIcon = (item: Partial<RawCategory>) => {
    const candidates = [item.icon, item.iconUrl, item.icon_url]
    for (const candidate of candidates) {
      if (typeof candidate === 'string') {
        const trimmed = candidate.trim()
        if (trimmed.length > 0) {
          return trimmed
        }
      }
    }
    return null
  }

  const children = (raw.children ?? []).map(child => ({
    ...child,
    icon: resolveIcon(child)
  }))
  // Prefer a rich object (often under extra_fields) over an array fallback.
  let rawExtra: unknown
  if ((raw as any).extra_fields !== undefined && !Array.isArray((raw as any).extra_fields)) {
    rawExtra = (raw as any).extra_fields
  } else if ((raw as any).extraFields !== undefined) {
    rawExtra = (raw as any).extraFields
  } else {
    rawExtra = (raw as any).extra_fields
  }

  let extraFieldsRaw: unknown = rawExtra
  if (typeof rawExtra === 'string') {
    try {
      extraFieldsRaw = JSON.parse(rawExtra)
    } catch (err) {
      console.warn('Unable to parse extraFields JSON', err)
    }
  }

  const extraFields = Array.isArray(extraFieldsRaw) ? [...extraFieldsRaw] : []
  children.sort((a, b) =>
    a.name.localeCompare(b.name, NAME_LOCALE, { sensitivity: 'base' })
  )

  return {
    ...category,
    icon: resolveIcon(raw),
    parentId,
    children,
    extraFields,
    extraFieldsRaw:
      !Array.isArray(extraFieldsRaw) && extraFieldsRaw && typeof extraFieldsRaw === 'object'
        ? (extraFieldsRaw as Record<string, unknown>)
        : null
  }
}
