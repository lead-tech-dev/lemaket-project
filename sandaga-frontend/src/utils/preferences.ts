import type { SortOption } from '../components/ui/SortSelect'

const SORT_PREFERENCE_KEY = 'sandaga.sortPreference'
const SELLER_TYPE_PREFERENCE_KEY = 'sandaga.sellerTypePreference'
const LIMIT_PREFERENCE_KEY = 'sandaga.limitPreference'
const PRICE_BAND_PREFERENCE_KEY = 'sandaga.priceBandPreference'
const RADIUS_PREFERENCE_KEY = 'sandaga.radiusPreference'
const PROMOTION_CATEGORY_KEY = 'sandaga.promotions.category'
const PROMOTION_SELECTION_KEY = 'sandaga.promotions.selection'

export type PromotionCheckoutSelection = {
  optionId?: string
  listingId?: string
  paymentMethodId?: string
}

export function getSortPreference(): SortOption | null {
  if (typeof window === 'undefined') {
    return null
  }

  const value = window.localStorage.getItem(SORT_PREFERENCE_KEY)
  if (value === 'recent' || value === 'priceAsc' || value === 'priceDesc') {
    return value
  }
  return null
}

export function setSortPreference(value: SortOption) {
  if (typeof window === 'undefined') {
    return
  }
  window.localStorage.setItem(SORT_PREFERENCE_KEY, value)
}

export function clearSortPreference() {
  if (typeof window === 'undefined') {
    return
  }
  window.localStorage.removeItem(SORT_PREFERENCE_KEY)
}

export function getSellerTypePreference(): string | null {
  if (typeof window === 'undefined') {
    return null
  }
  const value = window.localStorage.getItem(SELLER_TYPE_PREFERENCE_KEY)
  if (value === 'all' || value === 'pro' || value === 'individual') {
    return value
  }
  return null
}

export function setSellerTypePreference(value: string) {
  if (typeof window === 'undefined') {
    return
  }
  window.localStorage.setItem(SELLER_TYPE_PREFERENCE_KEY, value)
}

export function clearSellerTypePreference() {
  if (typeof window === 'undefined') {
    return
  }
  window.localStorage.removeItem(SELLER_TYPE_PREFERENCE_KEY)
}

export function getLimitPreference(): number | null {
  if (typeof window === 'undefined') {
    return null
  }
  const raw = window.localStorage.getItem(LIMIT_PREFERENCE_KEY)
  if (!raw) {
    return null
  }
  const parsed = Number(raw)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

export function setLimitPreference(value: number) {
  if (typeof window === 'undefined') {
    return
  }
  window.localStorage.setItem(LIMIT_PREFERENCE_KEY, String(value))
}

export function clearLimitPreference() {
  if (typeof window === 'undefined') {
    return
  }
  window.localStorage.removeItem(LIMIT_PREFERENCE_KEY)
}

export function getPriceBandPreference(): string | null {
  if (typeof window === 'undefined') {
    return null
  }
  return window.localStorage.getItem(PRICE_BAND_PREFERENCE_KEY)
}

export function setPriceBandPreference(value: string) {
  if (typeof window === 'undefined') {
    return
  }
  window.localStorage.setItem(PRICE_BAND_PREFERENCE_KEY, value)
}

export function clearPriceBandPreference() {
  if (typeof window === 'undefined') {
    return
  }
  window.localStorage.removeItem(PRICE_BAND_PREFERENCE_KEY)
}

export function getRadiusPreference(): string | null {
  if (typeof window === 'undefined') {
    return null
  }
  return window.localStorage.getItem(RADIUS_PREFERENCE_KEY)
}

export function setRadiusPreference(value: string) {
  if (typeof window === 'undefined') {
    return
  }
  window.localStorage.setItem(RADIUS_PREFERENCE_KEY, value)
}

export function clearRadiusPreference() {
  if (typeof window === 'undefined') {
    return
  }
  window.localStorage.removeItem(RADIUS_PREFERENCE_KEY)
}

export function getPromotionCategoryPreference(): string | null {
  if (typeof window === 'undefined') {
    return null
  }
  return window.localStorage.getItem(PROMOTION_CATEGORY_KEY)
}

export function setPromotionCategoryPreference(value: string) {
  if (typeof window === 'undefined') {
    return
  }
  window.localStorage.setItem(PROMOTION_CATEGORY_KEY, value)
}

export function clearPromotionCategoryPreference() {
  if (typeof window === 'undefined') {
    return
  }
  window.localStorage.removeItem(PROMOTION_CATEGORY_KEY)
}

export function getPromotionCheckoutSelection(): PromotionCheckoutSelection | null {
  if (typeof window === 'undefined') {
    return null
  }
  const raw = window.localStorage.getItem(PROMOTION_SELECTION_KEY)
  if (!raw) {
    return null
  }
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') {
      return parsed as PromotionCheckoutSelection
    }
  } catch {
    // ignore invalid cache payload
  }
  return null
}

export function setPromotionCheckoutSelection(value: PromotionCheckoutSelection) {
  if (typeof window === 'undefined') {
    return
  }
  try {
    window.localStorage.setItem(PROMOTION_SELECTION_KEY, JSON.stringify(value))
  } catch {
    // ignore quota errors
  }
}

export function clearPromotionCheckoutSelection() {
  if (typeof window === 'undefined') {
    return
  }
  window.localStorage.removeItem(PROMOTION_SELECTION_KEY)
}
