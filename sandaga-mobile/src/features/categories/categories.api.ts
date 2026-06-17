import { http } from '@/core/api/http'

export type CategoryNode = {
  id: string
  name: string
  slug: string
  description?: string | null
  parentId: string | null
  isActive: boolean
  icon?: string | null
  color?: string | null
  gradient?: string | null
  children: {
    id: string
    name: string
    slug: string
    description?: string | null
    icon?: string | null
    color?: string | null
  }[]
}

export const categoriesApi = {
  active: () => http.get<CategoryNode[]>('/categories?active=true')
}
