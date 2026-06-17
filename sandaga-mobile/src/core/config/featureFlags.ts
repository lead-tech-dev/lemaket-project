export type MobileFeatureFlagName =
  | 'homeStorefronts'
  | 'dashboardOverview'
  | 'dashboardOrders'
  | 'dashboardDeliveries'
  | 'dashboardFollows'
  | 'dashboardAlerts'
  | 'dashboardNotifications'
  | 'dashboardWallet'
  | 'dashboardPayments'
  | 'dashboardPro'
  | 'dashboardPromotions'
  | 'dashboardBackendRoutes'
  | 'dashboardVerification'
  | 'dashboardSubscriptions'
  | 'dashboardCourier'

export type MobileFeatureFlags = Record<MobileFeatureFlagName, boolean>

export const defaultMobileFeatureFlags: MobileFeatureFlags = {
  // V1 launch scope: keep only core marketplace features enabled.
  homeStorefronts: false,
  dashboardOverview: false,
  dashboardOrders: false,
  dashboardDeliveries: false,
  dashboardFollows: false,
  dashboardAlerts: false,
  dashboardNotifications: false,
  dashboardWallet: false,
  dashboardPayments: true,
  dashboardPro: false,
  dashboardPromotions: true,
  dashboardBackendRoutes: false,
  dashboardVerification: false,
  dashboardSubscriptions: false,
  dashboardCourier: false
}

function parseMobileFeatureFlagRecord(value: unknown): Partial<MobileFeatureFlags> {
  if (!value || typeof value !== 'object') {
    return {}
  }

  const result: Partial<MobileFeatureFlags> = {}
  for (const key of Object.keys(value)) {
    if ((key as MobileFeatureFlagName) in defaultMobileFeatureFlags) {
      const raw = (value as Record<string, unknown>)[key]
      if (typeof raw === 'boolean') {
        result[key as MobileFeatureFlagName] = raw
      } else if (typeof raw === 'string') {
        if (raw.toLowerCase() === 'true') {
          result[key as MobileFeatureFlagName] = true
        }
        if (raw.toLowerCase() === 'false') {
          result[key as MobileFeatureFlagName] = false
        }
      }
    }
  }

  return result
}

function parseEnvFlags(): Partial<MobileFeatureFlags> {
  const raw = process.env.EXPO_PUBLIC_FEATURE_FLAGS
  if (!raw) {
    return {}
  }

  try {
    return parseMobileFeatureFlagRecord(JSON.parse(raw))
  } catch (err) {
    console.warn('Impossible de parser EXPO_PUBLIC_FEATURE_FLAGS', err)
    return {}
  }
}

export const mobileFeatureFlags: MobileFeatureFlags = {
  ...defaultMobileFeatureFlags,
  ...parseEnvFlags()
}

export function isMobileFeatureEnabled(flag: MobileFeatureFlagName): boolean {
  return mobileFeatureFlags[flag]
}

type RouteGateRule = {
  prefix: string
  flag: MobileFeatureFlagName
  fallback: '/(tabs)/profile' | '/(tabs)/index'
}

const routeGateRules: RouteGateRule[] = [
  { prefix: '/dashboard/overview', flag: 'dashboardOverview', fallback: '/(tabs)/profile' },
  { prefix: '/dashboard/orders', flag: 'dashboardOrders', fallback: '/(tabs)/profile' },
  { prefix: '/dashboard/deliveries', flag: 'dashboardDeliveries', fallback: '/(tabs)/profile' },
  { prefix: '/dashboard/follows', flag: 'dashboardFollows', fallback: '/(tabs)/profile' },
  { prefix: '/dashboard/alerts', flag: 'dashboardAlerts', fallback: '/(tabs)/profile' },
  { prefix: '/dashboard/notifications', flag: 'dashboardNotifications', fallback: '/(tabs)/profile' },
  { prefix: '/dashboard/wallet', flag: 'dashboardWallet', fallback: '/(tabs)/profile' },
  { prefix: '/dashboard/payments', flag: 'dashboardPayments', fallback: '/(tabs)/profile' },
  { prefix: '/dashboard/pro', flag: 'dashboardPro', fallback: '/(tabs)/profile' },
  { prefix: '/dashboard/promotions', flag: 'dashboardPromotions', fallback: '/(tabs)/profile' },
  { prefix: '/dashboard/backend-routes', flag: 'dashboardBackendRoutes', fallback: '/(tabs)/profile' },
  { prefix: '/dashboard/verification', flag: 'dashboardVerification', fallback: '/(tabs)/profile' },
  { prefix: '/dashboard/subscriptions', flag: 'dashboardSubscriptions', fallback: '/(tabs)/profile' },
  { prefix: '/dashboard/courier', flag: 'dashboardCourier', fallback: '/(tabs)/profile' }
]

function normalizePathname(pathname: string): string {
  const value = pathname.trim()
  if (!value) {
    return '/'
  }
  if (value !== '/' && value.endsWith('/')) {
    return value.slice(0, -1)
  }
  return value
}

export function getFeatureFlagFallbackPath(pathname: string): RouteGateRule['fallback'] | null {
  const normalized = normalizePathname(pathname)

  const matchedRule = routeGateRules.find(rule => {
    return normalized === rule.prefix || normalized.startsWith(`${rule.prefix}/`)
  })

  if (!matchedRule) {
    return null
  }

  return isMobileFeatureEnabled(matchedRule.flag) ? null : matchedRule.fallback
}
