export const SEARCH_OPERATIONAL_ALERT_SETTING_KEYS = {
  alertWindowSeconds: 'monitoring.search.alertWindowSeconds',
  minListingsRequests: 'monitoring.search.minListingsRequests',
  minSuggestionsRequests: 'monitoring.search.minSuggestionsRequests',
  listingsP95Ms: 'monitoring.search.listingsP95Ms',
  listingsErrorRate: 'monitoring.search.listingsErrorRate',
  suggestionsP95Ms: 'monitoring.search.suggestionsP95Ms',
  suggestionsErrorRate: 'monitoring.search.suggestionsErrorRate',
  dispatchEnabled: 'monitoring.search.dispatchEnabled',
  dispatchCooldownSeconds: 'monitoring.search.dispatchCooldownSeconds',
  dispatchAutoEnabled: 'monitoring.search.dispatchAutoEnabled',
  dispatchIntervalSeconds: 'monitoring.search.dispatchIntervalSeconds',
  dispatchOnBoot: 'monitoring.search.dispatchOnBoot'
} as const;

export type SearchOperationalAlertSettings = {
  alertWindowSeconds: number;
  minListingsRequests: number;
  minSuggestionsRequests: number;
  listingsP95Ms: number;
  listingsErrorRate: number;
  suggestionsP95Ms: number;
  suggestionsErrorRate: number;
  dispatchEnabled: boolean;
  dispatchCooldownSeconds: number;
  dispatchAutoEnabled: boolean;
  dispatchIntervalSeconds: number;
  dispatchOnBoot: boolean;
};

export const DEFAULT_SEARCH_OPERATIONAL_ALERT_SETTINGS: SearchOperationalAlertSettings = {
  alertWindowSeconds: 300,
  minListingsRequests: 20,
  minSuggestionsRequests: 20,
  listingsP95Ms: 1200,
  listingsErrorRate: 0.05,
  suggestionsP95Ms: 400,
  suggestionsErrorRate: 0.05,
  dispatchEnabled: true,
  dispatchCooldownSeconds: 900,
  dispatchAutoEnabled: true,
  dispatchIntervalSeconds: 300,
  dispatchOnBoot: false
};
