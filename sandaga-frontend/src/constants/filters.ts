export type PriceBandOption = {
  id: string
  min?: number
  max?: number
}

type Translate = (key: string, values?: Record<string, string | number>) => string

export const PRICE_BANDS: PriceBandOption[] = [
  { id: 'all' },
  { id: 'lt100', max: 10000 },
  { id: '100-500', min: 10000, max: 50000 },
  { id: '500-1000', min: 50000, max: 100000 },
  { id: 'gt1000', min: 100000 }
]

export type RadiusOption = {
  value: string
  label: string
}

export const getPriceBandLabel = (t: Translate, id: string) =>
  t(`filters.priceBand.${id}`)

export const RADIUS_OPTIONS: RadiusOption[] = [
  { value: '10', label: '10 km' },
  { value: '25', label: '25 km' },
  { value: '50', label: '50 km' },
  { value: '100', label: '100 km' }
]

export function resolvePriceBand(id: string | undefined) {
  return PRICE_BANDS.find(band => band.id === id)
}
