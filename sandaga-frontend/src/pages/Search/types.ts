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
  coordinates: [number, number] | null
  cityId?: string
  neighborhoodId?: string
  city?: string | null
  zipcode?: string | null
}
