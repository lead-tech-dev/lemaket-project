export type BackendRouteItem = {
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  route: string
  group: string
  file: string
}

export const backendRoutes: BackendRouteItem[] = [
  {
    "method": "GET",
    "route": "/admin/activities",
    "group": "admin",
    "file": "admin/admin.controller.ts"
  },
  {
    "method": "GET",
    "route": "/admin/audit/:scope",
    "group": "admin",
    "file": "admin/admin.controller.ts"
  },
  {
    "method": "GET",
    "route": "/admin/company-verifications",
    "group": "admin",
    "file": "admin/admin.controller.ts"
  },
  {
    "method": "GET",
    "route": "/admin/courier-verifications",
    "group": "admin",
    "file": "admin/admin.controller.ts"
  },
  {
    "method": "POST",
    "route": "/admin/export/:scope",
    "group": "admin",
    "file": "admin/admin-export.controller.ts"
  },
  {
    "method": "GET",
    "route": "/admin/export/jobs/:jobId",
    "group": "admin",
    "file": "admin/admin-export.controller.ts"
  },
  {
    "method": "GET",
    "route": "/admin/export/jobs/:jobId/download",
    "group": "admin",
    "file": "admin/admin-export.controller.ts"
  },
  {
    "method": "DELETE",
    "route": "/admin/forms/fields/:id",
    "group": "admin",
    "file": "forms/form-fields.controller.ts"
  },
  {
    "method": "GET",
    "route": "/admin/forms/fields/:id",
    "group": "admin",
    "file": "forms/form-fields.controller.ts"
  },
  {
    "method": "PATCH",
    "route": "/admin/forms/fields/:id",
    "group": "admin",
    "file": "forms/form-fields.controller.ts"
  },
  {
    "method": "GET",
    "route": "/admin/forms/fields/step/:stepId",
    "group": "admin",
    "file": "forms/form-fields.controller.ts"
  },
  {
    "method": "POST",
    "route": "/admin/forms/fields/step/:stepId",
    "group": "admin",
    "file": "forms/form-fields.controller.ts"
  },
  {
    "method": "DELETE",
    "route": "/admin/forms/steps/:id",
    "group": "admin",
    "file": "forms/form-steps.controller.ts"
  },
  {
    "method": "GET",
    "route": "/admin/forms/steps/:id",
    "group": "admin",
    "file": "forms/form-steps.controller.ts"
  },
  {
    "method": "PATCH",
    "route": "/admin/forms/steps/:id",
    "group": "admin",
    "file": "forms/form-steps.controller.ts"
  },
  {
    "method": "GET",
    "route": "/admin/forms/steps/category/:categoryId",
    "group": "admin",
    "file": "forms/form-steps.controller.ts"
  },
  {
    "method": "POST",
    "route": "/admin/forms/steps/category/:categoryId",
    "group": "admin",
    "file": "forms/form-steps.controller.ts"
  },
  {
    "method": "GET",
    "route": "/admin/logs",
    "group": "admin",
    "file": "admin/admin.controller.ts"
  },
  {
    "method": "GET",
    "route": "/admin/message-notification-logs",
    "group": "admin",
    "file": "admin/admin.controller.ts"
  },
  {
    "method": "GET",
    "route": "/admin/metrics",
    "group": "admin",
    "file": "admin/admin.controller.ts"
  },
  {
    "method": "GET",
    "route": "/admin/moderation/listings",
    "group": "admin",
    "file": "admin/admin-moderation.controller.ts"
  },
  {
    "method": "PATCH",
    "route": "/admin/moderation/listings/status",
    "group": "admin",
    "file": "admin/admin-moderation.controller.ts"
  },
  {
    "method": "GET",
    "route": "/admin/platform-wallet",
    "group": "admin",
    "file": "admin/admin.controller.ts"
  },
  {
    "method": "GET",
    "route": "/admin/platform-wallet/transactions",
    "group": "admin",
    "file": "admin/admin.controller.ts"
  },
  {
    "method": "GET",
    "route": "/admin/platform-wallet/transactions/export",
    "group": "admin",
    "file": "admin/admin.controller.ts"
  },
  {
    "method": "GET",
    "route": "/admin/promotions",
    "group": "admin",
    "file": "promotions/promotions.controller.ts"
  },
  {
    "method": "POST",
    "route": "/admin/promotions",
    "group": "admin",
    "file": "promotions/promotions.controller.ts"
  },
  {
    "method": "DELETE",
    "route": "/admin/promotions/:id",
    "group": "admin",
    "file": "promotions/promotions.controller.ts"
  },
  {
    "method": "GET",
    "route": "/admin/promotions/:id",
    "group": "admin",
    "file": "promotions/promotions.controller.ts"
  },
  {
    "method": "PATCH",
    "route": "/admin/promotions/:id",
    "group": "admin",
    "file": "promotions/promotions.controller.ts"
  },
  {
    "method": "PATCH",
    "route": "/admin/promotions/:id/status",
    "group": "admin",
    "file": "promotions/promotions.controller.ts"
  },
  {
    "method": "GET",
    "route": "/admin/settings",
    "group": "admin",
    "file": "admin/admin.controller.ts"
  },
  {
    "method": "POST",
    "route": "/admin/settings",
    "group": "admin",
    "file": "admin/admin.controller.ts"
  },
  {
    "method": "POST",
    "route": "/admin/settings/:key",
    "group": "admin",
    "file": "admin/admin.controller.ts"
  },
  {
    "method": "GET",
    "route": "/admin/zikopay/transactions",
    "group": "admin",
    "file": "admin/admin.controller.ts"
  },
  {
    "method": "GET",
    "route": "/admin/zikopay/transactions/export",
    "group": "admin",
    "file": "admin/admin.controller.ts"
  },
  {
    "method": "GET",
    "route": "/alerts",
    "group": "alerts",
    "file": "alerts/alerts.controller.ts"
  },
  {
    "method": "POST",
    "route": "/alerts",
    "group": "alerts",
    "file": "alerts/alerts.controller.ts"
  },
  {
    "method": "DELETE",
    "route": "/alerts/:id",
    "group": "alerts",
    "file": "alerts/alerts.controller.ts"
  },
  {
    "method": "PATCH",
    "route": "/alerts/:id",
    "group": "alerts",
    "file": "alerts/alerts.controller.ts"
  },
  {
    "method": "POST",
    "route": "/auth/forgot-password",
    "group": "auth",
    "file": "auth/auth.controller.ts"
  },
  {
    "method": "POST",
    "route": "/auth/login",
    "group": "auth",
    "file": "auth/auth.controller.ts"
  },
  {
    "method": "POST",
    "route": "/auth/logout",
    "group": "auth",
    "file": "auth/auth.controller.ts"
  },
  {
    "method": "POST",
    "route": "/auth/register",
    "group": "auth",
    "file": "auth/auth.controller.ts"
  },
  {
    "method": "POST",
    "route": "/auth/reset-password",
    "group": "auth",
    "file": "auth/auth.controller.ts"
  },
  {
    "method": "GET",
    "route": "/categories",
    "group": "categories",
    "file": "categories/categories.controller.ts"
  },
  {
    "method": "POST",
    "route": "/categories",
    "group": "categories",
    "file": "categories/categories.controller.ts"
  },
  {
    "method": "DELETE",
    "route": "/categories/:id",
    "group": "categories",
    "file": "categories/categories.controller.ts"
  },
  {
    "method": "GET",
    "route": "/categories/:id",
    "group": "categories",
    "file": "categories/categories.controller.ts"
  },
  {
    "method": "PATCH",
    "route": "/categories/:id",
    "group": "categories",
    "file": "categories/categories.controller.ts"
  },
  {
    "method": "GET",
    "route": "/categories/:id/form",
    "group": "categories",
    "file": "categories/categories.controller.ts"
  },
  {
    "method": "GET",
    "route": "/categories/slug/:slug",
    "group": "categories",
    "file": "categories/categories.controller.ts"
  },
  {
    "method": "GET",
    "route": "/dashboard/overview",
    "group": "dashboard",
    "file": "dashboard/dashboard.controller.ts"
  },
  {
    "method": "POST",
    "route": "/deliveries",
    "group": "deliveries",
    "file": "deliveries/deliveries.controller.ts"
  },
  {
    "method": "POST",
    "route": "/deliveries/:id/accept",
    "group": "deliveries",
    "file": "deliveries/deliveries.controller.ts"
  },
  {
    "method": "POST",
    "route": "/deliveries/:id/cancel",
    "group": "deliveries",
    "file": "deliveries/deliveries.controller.ts"
  },
  {
    "method": "GET",
    "route": "/deliveries/:id/delivery/code",
    "group": "deliveries",
    "file": "deliveries/deliveries.controller.ts"
  },
  {
    "method": "POST",
    "route": "/deliveries/:id/delivery/confirm",
    "group": "deliveries",
    "file": "deliveries/deliveries.controller.ts"
  },
  {
    "method": "POST",
    "route": "/deliveries/:id/escrow",
    "group": "deliveries",
    "file": "deliveries/deliveries.controller.ts"
  },
  {
    "method": "POST",
    "route": "/deliveries/:id/escrow/release",
    "group": "deliveries",
    "file": "deliveries/deliveries.controller.ts"
  },
  {
    "method": "GET",
    "route": "/deliveries/:id/pickup/code",
    "group": "deliveries",
    "file": "deliveries/deliveries.controller.ts"
  },
  {
    "method": "POST",
    "route": "/deliveries/:id/pickup/confirm",
    "group": "deliveries",
    "file": "deliveries/deliveries.controller.ts"
  },
  {
    "method": "PATCH",
    "route": "/deliveries/:id/status",
    "group": "deliveries",
    "file": "deliveries/deliveries.controller.ts"
  },
  {
    "method": "GET",
    "route": "/deliveries/available",
    "group": "deliveries",
    "file": "deliveries/deliveries.controller.ts"
  },
  {
    "method": "POST",
    "route": "/deliveries/escrow/init",
    "group": "deliveries",
    "file": "deliveries/deliveries.controller.ts"
  },
  {
    "method": "GET",
    "route": "/deliveries/listing/:listingId",
    "group": "deliveries",
    "file": "deliveries/deliveries.controller.ts"
  },
  {
    "method": "GET",
    "route": "/deliveries/mine",
    "group": "deliveries",
    "file": "deliveries/deliveries.controller.ts"
  },
  {
    "method": "GET",
    "route": "/favorites",
    "group": "favorites",
    "file": "favorites/favorites.controller.ts"
  },
  {
    "method": "DELETE",
    "route": "/favorites/:listingId",
    "group": "favorites",
    "file": "favorites/favorites.controller.ts"
  },
  {
    "method": "POST",
    "route": "/favorites/:listingId",
    "group": "favorites",
    "file": "favorites/favorites.controller.ts"
  },
  {
    "method": "GET",
    "route": "/geo/autocomplete",
    "group": "geo",
    "file": "geo/geo.controller.ts"
  },
  {
    "method": "GET",
    "route": "/geo/cities",
    "group": "geo",
    "file": "geo/geo.controller.ts"
  },
  {
    "method": "GET",
    "route": "/geo/nearby",
    "group": "geo",
    "file": "geo/geo.controller.ts"
  },
  {
    "method": "GET",
    "route": "/geo/neighborhoods",
    "group": "geo",
    "file": "geo/geo.controller.ts"
  },
  {
    "method": "GET",
    "route": "/geo/reverse",
    "group": "geo",
    "file": "geo/geo.controller.ts"
  },
  {
    "method": "GET",
    "route": "/health",
    "group": "health",
    "file": "app.controller.ts"
  },
  {
    "method": "GET",
    "route": "/home",
    "group": "home",
    "file": "home/home.controller.ts"
  },
  {
    "method": "GET",
    "route": "/home/categories",
    "group": "home",
    "file": "home/home.controller.ts"
  },
  {
    "method": "GET",
    "route": "/home/hero",
    "group": "home",
    "file": "home/home.controller.ts"
  },
  {
    "method": "GET",
    "route": "/home/listings",
    "group": "home",
    "file": "home/home.controller.ts"
  },
  {
    "method": "GET",
    "route": "/home/listings/featured",
    "group": "home",
    "file": "home/home.controller.ts"
  },
  {
    "method": "GET",
    "route": "/home/listings/latest",
    "group": "home",
    "file": "home/home.controller.ts"
  },
  {
    "method": "GET",
    "route": "/home/seller-split",
    "group": "home",
    "file": "home/home.controller.ts"
  },
  {
    "method": "GET",
    "route": "/home/services",
    "group": "home",
    "file": "home/home.controller.ts"
  },
  {
    "method": "GET",
    "route": "/home/storefronts",
    "group": "home",
    "file": "home/home.controller.ts"
  },
  {
    "method": "GET",
    "route": "/home/testimonials",
    "group": "home",
    "file": "home/home.controller.ts"
  },
  {
    "method": "GET",
    "route": "/home/trending-searches",
    "group": "home",
    "file": "home/home.controller.ts"
  },
  {
    "method": "GET",
    "route": "/links/:slug",
    "group": "links",
    "file": "links/links.controller.ts"
  },
  {
    "method": "POST",
    "route": "/links/shorten",
    "group": "links",
    "file": "links/links.controller.ts"
  },
  {
    "method": "GET",
    "route": "/listings",
    "group": "listings",
    "file": "listings/listings.controller.ts"
  },
  {
    "method": "POST",
    "route": "/listings",
    "group": "listings",
    "file": "listings/listings.controller.ts"
  },
  {
    "method": "DELETE",
    "route": "/listings/:id",
    "group": "listings",
    "file": "listings/listings.controller.ts"
  },
  {
    "method": "GET",
    "route": "/listings/:id",
    "group": "listings",
    "file": "listings/listings.controller.ts"
  },
  {
    "method": "PATCH",
    "route": "/listings/:id",
    "group": "listings",
    "file": "listings/listings.controller.ts"
  },
  {
    "method": "GET",
    "route": "/listings/:id/export",
    "group": "listings",
    "file": "listings/listings.controller.ts"
  },
  {
    "method": "POST",
    "route": "/listings/:id/images",
    "group": "listings",
    "file": "listings/listings.controller.ts"
  },
  {
    "method": "DELETE",
    "route": "/listings/:id/images/:imageId",
    "group": "listings",
    "file": "listings/listings.controller.ts"
  },
  {
    "method": "GET",
    "route": "/listings/:id/og",
    "group": "listings",
    "file": "listings/listings.controller.ts"
  },
  {
    "method": "GET",
    "route": "/listings/:id/similar",
    "group": "listings",
    "file": "listings/listings.controller.ts"
  },
  {
    "method": "PATCH",
    "route": "/listings/:id/status",
    "group": "listings",
    "file": "listings/listings.controller.ts"
  },
  {
    "method": "POST",
    "route": "/listings/:id/views",
    "group": "listings",
    "file": "listings/listings.controller.ts"
  },
  {
    "method": "GET",
    "route": "/listings/featured",
    "group": "listings",
    "file": "listings/listings.controller.ts"
  },
  {
    "method": "GET",
    "route": "/listings/form-schema/:categoryId",
    "group": "listings",
    "file": "listings/listings.controller.ts"
  },
  {
    "method": "GET",
    "route": "/listings/latest",
    "group": "listings",
    "file": "listings/listings.controller.ts"
  },
  {
    "method": "GET",
    "route": "/listings/me",
    "group": "listings",
    "file": "listings/listings.controller.ts"
  },
  {
    "method": "GET",
    "route": "/listings/pending",
    "group": "listings",
    "file": "listings/listings.controller.ts"
  },
  {
    "method": "GET",
    "route": "/listings/price-suggestion",
    "group": "listings",
    "file": "listings/listings.controller.ts"
  },
  {
    "method": "POST",
    "route": "/media/upload",
    "group": "media",
    "file": "media/media.controller.ts"
  },
  {
    "method": "GET",
    "route": "/messages/conversations",
    "group": "messages",
    "file": "messages/messages.controller.ts"
  },
  {
    "method": "POST",
    "route": "/messages/conversations",
    "group": "messages",
    "file": "messages/messages.controller.ts"
  },
  {
    "method": "GET",
    "route": "/messages/conversations/:id",
    "group": "messages",
    "file": "messages/messages.controller.ts"
  },
  {
    "method": "POST",
    "route": "/messages/conversations/:id/ai-reply",
    "group": "messages",
    "file": "messages/messages.controller.ts"
  },
  {
    "method": "POST",
    "route": "/messages/conversations/:id/attachments",
    "group": "messages",
    "file": "messages/messages.controller.ts"
  },
  {
    "method": "GET",
    "route": "/messages/conversations/:id/messages",
    "group": "messages",
    "file": "messages/messages.controller.ts"
  },
  {
    "method": "POST",
    "route": "/messages/conversations/:id/messages",
    "group": "messages",
    "file": "messages/messages.controller.ts"
  },
  {
    "method": "POST",
    "route": "/messages/conversations/:id/read",
    "group": "messages",
    "file": "messages/messages.controller.ts"
  },
  {
    "method": "GET",
    "route": "/messages/quick-replies",
    "group": "messages",
    "file": "messages/messages.controller.ts"
  },
  {
    "method": "POST",
    "route": "/messages/quick-replies",
    "group": "messages",
    "file": "messages/messages.controller.ts"
  },
  {
    "method": "DELETE",
    "route": "/messages/quick-replies/:id",
    "group": "messages",
    "file": "messages/messages.controller.ts"
  },
  {
    "method": "PATCH",
    "route": "/messages/quick-replies/:id",
    "group": "messages",
    "file": "messages/messages.controller.ts"
  },
  {
    "method": "GET",
    "route": "/metrics",
    "group": "metrics",
    "file": "monitoring/monitoring.controller.ts"
  },
  {
    "method": "GET",
    "route": "/notifications",
    "group": "notifications",
    "file": "notifications/notifications.controller.ts"
  },
  {
    "method": "PATCH",
    "route": "/notifications/:id/read",
    "group": "notifications",
    "file": "notifications/notifications.controller.ts"
  },
  {
    "method": "PATCH",
    "route": "/notifications/read-all",
    "group": "notifications",
    "file": "notifications/notifications.controller.ts"
  },
  {
    "method": "GET",
    "route": "/orders/:id",
    "group": "orders",
    "file": "orders/orders.controller.ts"
  },
  {
    "method": "GET",
    "route": "/orders/mine",
    "group": "orders",
    "file": "orders/orders.controller.ts"
  },
  {
    "method": "POST",
    "route": "/payments/checkout",
    "group": "payments",
    "file": "payments/payments.controller.ts"
  },
  {
    "method": "GET",
    "route": "/payments/checkout/sessions/:id",
    "group": "payments",
    "file": "payments/payments.controller.ts"
  },
  {
    "method": "GET",
    "route": "/payments/flutterwave/verify",
    "group": "payments",
    "file": "payments/payments.controller.ts"
  },
  {
    "method": "POST",
    "route": "/payments/flutterwave/webhook",
    "group": "payments",
    "file": "payments/payments.webhook.controller.ts"
  },
  {
    "method": "GET",
    "route": "/payments/invoices",
    "group": "payments",
    "file": "payments/payments.controller.ts"
  },
  {
    "method": "GET",
    "route": "/payments/invoices/:id",
    "group": "payments",
    "file": "payments/payments.controller.ts"
  },
  {
    "method": "GET",
    "route": "/payments/methods",
    "group": "payments",
    "file": "payments/payments.controller.ts"
  },
  {
    "method": "POST",
    "route": "/payments/methods",
    "group": "payments",
    "file": "payments/payments.controller.ts"
  },
  {
    "method": "DELETE",
    "route": "/payments/methods/:id",
    "group": "payments",
    "file": "payments/payments.controller.ts"
  },
  {
    "method": "PATCH",
    "route": "/payments/methods/:id",
    "group": "payments",
    "file": "payments/payments.controller.ts"
  },
  {
    "method": "POST",
    "route": "/payments/methods/:id/confirm",
    "group": "payments",
    "file": "payments/payments.controller.ts"
  },
  {
    "method": "POST",
    "route": "/payments/methods/:id/verify",
    "group": "payments",
    "file": "payments/payments.controller.ts"
  },
  {
    "method": "POST",
    "route": "/payments/mtn/init",
    "group": "payments",
    "file": "payments/payments.controller.ts"
  },
  {
    "method": "POST",
    "route": "/payments/mtn/webhook",
    "group": "payments",
    "file": "payments/payments.webhook.controller.ts"
  },
  {
    "method": "GET",
    "route": "/payments/options",
    "group": "payments",
    "file": "payments/payments.controller.ts"
  },
  {
    "method": "POST",
    "route": "/payments/orange/init",
    "group": "payments",
    "file": "payments/payments.controller.ts"
  },
  {
    "method": "POST",
    "route": "/payments/orange/webhook",
    "group": "payments",
    "file": "payments/payments.webhook.controller.ts"
  },
  {
    "method": "POST",
    "route": "/payments/pro-plans",
    "group": "payments",
    "file": "payments/payments.controller.ts"
  },
  {
    "method": "GET",
    "route": "/payments/subscriptions",
    "group": "payments",
    "file": "payments/payments.controller.ts"
  },
  {
    "method": "POST",
    "route": "/payments/subscriptions/:id/cancel",
    "group": "payments",
    "file": "payments/payments.controller.ts"
  },
  {
    "method": "POST",
    "route": "/payments/subscriptions/:id/resume",
    "group": "payments",
    "file": "payments/payments.controller.ts"
  },
  {
    "method": "GET",
    "route": "/payments/wallet",
    "group": "payments",
    "file": "payments/payments.controller.ts"
  },
  {
    "method": "POST",
    "route": "/payments/wallet/topup",
    "group": "payments",
    "file": "payments/payments.controller.ts"
  },
  {
    "method": "GET",
    "route": "/payments/wallet/transactions",
    "group": "payments",
    "file": "payments/payments.controller.ts"
  },
  {
    "method": "GET",
    "route": "/payments/wallet/transactions/export",
    "group": "payments",
    "file": "payments/payments.controller.ts"
  },
  {
    "method": "POST",
    "route": "/payments/wallet/withdraw",
    "group": "payments",
    "file": "payments/payments.controller.ts"
  },
  {
    "method": "GET",
    "route": "/payments/zikopay/verify",
    "group": "payments",
    "file": "payments/payments.controller.ts"
  },
  {
    "method": "POST",
    "route": "/payments/zikopay/webhook",
    "group": "payments",
    "file": "payments/payments.webhook.controller.ts"
  },
  {
    "method": "GET",
    "route": "/reports",
    "group": "reports",
    "file": "reports/reports.controller.ts"
  },
  {
    "method": "POST",
    "route": "/reports",
    "group": "reports",
    "file": "reports/reports.controller.ts"
  },
  {
    "method": "PATCH",
    "route": "/reports/:id",
    "group": "reports",
    "file": "reports/reports.controller.ts"
  },
  {
    "method": "POST",
    "route": "/reviews",
    "group": "reviews",
    "file": "reviews/reviews.controller.ts"
  },
  {
    "method": "GET",
    "route": "/reviews/sellers/:sellerId",
    "group": "reviews",
    "file": "reviews/reviews.controller.ts"
  },
  {
    "method": "POST",
    "route": "/reviews/users",
    "group": "reviews",
    "file": "reviews/reviews.controller.ts"
  },
  {
    "method": "GET",
    "route": "/storefronts/:slug",
    "group": "storefronts",
    "file": "storefronts/storefronts.controller.ts"
  },
  {
    "method": "GET",
    "route": "/storefronts/:slug/listings",
    "group": "storefronts",
    "file": "storefronts/storefronts.controller.ts"
  },
  {
    "method": "GET",
    "route": "/users",
    "group": "users",
    "file": "users/users.controller.ts"
  },
  {
    "method": "DELETE",
    "route": "/users/:id",
    "group": "users",
    "file": "users/users.controller.ts"
  },
  {
    "method": "GET",
    "route": "/users/:id",
    "group": "users",
    "file": "users/users.controller.ts"
  },
  {
    "method": "PATCH",
    "route": "/users/:id",
    "group": "users",
    "file": "users/users.controller.ts"
  },
  {
    "method": "DELETE",
    "route": "/users/:id/follow",
    "group": "users",
    "file": "users/users.controller.ts"
  },
  {
    "method": "POST",
    "route": "/users/:id/follow",
    "group": "users",
    "file": "users/users.controller.ts"
  },
  {
    "method": "GET",
    "route": "/users/:id/followers/count",
    "group": "users",
    "file": "users/users.controller.ts"
  },
  {
    "method": "PATCH",
    "route": "/users/:id/pro",
    "group": "users",
    "file": "users/users.controller.ts"
  },
  {
    "method": "GET",
    "route": "/users/couriers",
    "group": "users",
    "file": "users/users.controller.ts"
  },
  {
    "method": "DELETE",
    "route": "/users/me",
    "group": "users",
    "file": "users/users.controller.ts"
  },
  {
    "method": "GET",
    "route": "/users/me",
    "group": "users",
    "file": "users/users.controller.ts"
  },
  {
    "method": "PATCH",
    "route": "/users/me",
    "group": "users",
    "file": "users/users.controller.ts"
  },
  {
    "method": "GET",
    "route": "/users/me/addresses",
    "group": "users",
    "file": "users/users.controller.ts"
  },
  {
    "method": "POST",
    "route": "/users/me/addresses",
    "group": "users",
    "file": "users/users.controller.ts"
  },
  {
    "method": "DELETE",
    "route": "/users/me/addresses/:id",
    "group": "users",
    "file": "users/users.controller.ts"
  },
  {
    "method": "PATCH",
    "route": "/users/me/addresses/:id",
    "group": "users",
    "file": "users/users.controller.ts"
  },
  {
    "method": "PATCH",
    "route": "/users/me/change-password",
    "group": "users",
    "file": "users/users.controller.ts"
  },
  {
    "method": "POST",
    "route": "/users/me/company-doc",
    "group": "users",
    "file": "users/users.controller.ts"
  },
  {
    "method": "POST",
    "route": "/users/me/courier-doc",
    "group": "users",
    "file": "users/users.controller.ts"
  },
  {
    "method": "GET",
    "route": "/users/me/follows",
    "group": "users",
    "file": "users/users.controller.ts"
  },
  {
    "method": "GET",
    "route": "/users/me/follows/list",
    "group": "users",
    "file": "users/users.controller.ts"
  },
  {
    "method": "POST",
    "route": "/users/me/identity-docs",
    "group": "users",
    "file": "users/users.controller.ts"
  },
  {
    "method": "DELETE",
    "route": "/users/me/identity-docs/:documentId",
    "group": "users",
    "file": "users/users.controller.ts"
  },
  {
    "method": "PATCH",
    "route": "/users/me/settings",
    "group": "users",
    "file": "users/users.controller.ts"
  },
  {
    "method": "PATCH",
    "route": "/users/me/two-factor",
    "group": "users",
    "file": "users/users.controller.ts"
  },
  {
    "method": "GET",
    "route": "/users/public/:id",
    "group": "users",
    "file": "users/users.controller.ts"
  },
  {
    "method": "GET",
    "route": "/users/public/slug/:slug",
    "group": "users",
    "file": "users/users.controller.ts"
  }
]
