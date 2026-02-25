export type SearchViewMode = 'list' | 'grid'

export type SearchDrawerView =
  | 'main'
  | 'categoryParents'
  | 'categoryChildren'
  | 'criteriaList'
  | 'criteriaOptions'

export type LocationSuggestion = {
  id: string
  label: string
  context: string | null
  coordinates: [number, number]
  city?: string
  zipcode?: string
}
