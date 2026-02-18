export type Paginated<T> = {
  data: T[]
  total: number
  page: number
  limit: number
}
