export type ReportStatus = 'open' | 'in_review' | 'resolved' | 'dismissed'

export type Report = {
  id: string
  listingId: string
  listing?: {
    id: string
    title: string
    owner?: {
      id: string
      firstName?: string
      lastName?: string
      email?: string
    }
  } | null
  reporterId?: string | null
  reporter?: {
    id: string
    firstName?: string
    lastName?: string
    email?: string
  } | null
  status: ReportStatus
  reason: string
  details?: string | null
  contactEmail?: string | null
  contactPhone?: string | null
  resolutionNotes?: string | null
  resolvedAt?: string | null
  created_at: string
  updatedAt: string
}
