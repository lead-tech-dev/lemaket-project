const DEFAULT_ONLINE_THRESHOLD_MINUTES = 5

export const isUserOnline = (
  lastLoginAt?: string | null,
  thresholdMinutes: number = DEFAULT_ONLINE_THRESHOLD_MINUTES
): boolean => {
  if (!lastLoginAt) return false
  const timestamp = new Date(lastLoginAt).getTime()
  if (Number.isNaN(timestamp)) return false
  return Date.now() - timestamp <= thresholdMinutes * 60 * 1000
}

export const getPresenceLabel = (
  lastLoginAt?: string | null,
  locale: 'fr' | 'en' = 'fr',
  thresholdMinutes: number = DEFAULT_ONLINE_THRESHOLD_MINUTES
): string => {
  if (isUserOnline(lastLoginAt, thresholdMinutes)) {
    return locale === 'fr' ? 'En ligne' : 'Online'
  }
  return locale === 'fr' ? 'Hors ligne' : 'Offline'
}
