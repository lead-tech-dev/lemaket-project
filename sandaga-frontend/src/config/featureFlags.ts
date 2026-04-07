export type FeatureFlagName =
  | 'dashboardOrders'
  | 'dashboardDeliveries'
  | 'dashboardWallet'
  | 'homeStorefronts'
  | 'proOverview'
  | 'proMessaging'
  | 'proPayments'
  | 'proPortal'
  | 'proPromotions'
  | 'adminConsole'
  | 'adminSettings'
  | 'adminPromotions'
  | 'adminLogs'

export type FeatureFlags = Record<FeatureFlagName, boolean>

export const defaultFeatureFlags: FeatureFlags = {
  dashboardOrders: false,
  dashboardDeliveries: false,
  dashboardWallet: false,
  homeStorefronts: false,
  // V1 launch scope: advanced Pro/Admin modules are disabled by default.
  proOverview: false,
  proMessaging: true,
  proPayments: true,
  proPortal: false,
  proPromotions: true,
  adminConsole: true,
  adminSettings: false,
  adminPromotions: true,
  adminLogs: false
}

export function parseFeatureFlagRecord(value: unknown): Partial<FeatureFlags> {
  if (!value || typeof value !== 'object') {
    return {}
  }
  const result: Partial<FeatureFlags> = {}
  for (const key of Object.keys(value)) {
    if ((key as FeatureFlagName) in defaultFeatureFlags) {
      const raw = (value as Record<string, unknown>)[key]
      if (typeof raw === 'boolean') {
        result[key as FeatureFlagName] = raw
      } else if (typeof raw === 'string') {
        if (raw.toLowerCase() === 'true') {
          result[key as FeatureFlagName] = true
        }
        if (raw.toLowerCase() === 'false') {
          result[key as FeatureFlagName] = false
        }
      }
    }
  }
  return result
}
