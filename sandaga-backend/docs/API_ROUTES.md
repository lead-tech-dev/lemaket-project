# API Routes

Generated on 2026-03-13T12:59:07.853Z from NestJS controllers.

Total routes: **191**

## admin

| Method | Route | Controller |
|---|---|---|
| GET | `/admin/activities` | `admin/admin.controller.ts` |
| GET | `/admin/audit/:scope` | `admin/admin.controller.ts` |
| GET | `/admin/company-verifications` | `admin/admin.controller.ts` |
| GET | `/admin/courier-verifications` | `admin/admin.controller.ts` |
| POST | `/admin/export/:scope` | `admin/admin-export.controller.ts` |
| GET | `/admin/export/jobs/:jobId` | `admin/admin-export.controller.ts` |
| GET | `/admin/export/jobs/:jobId/download` | `admin/admin-export.controller.ts` |
| DELETE | `/admin/forms/fields/:id` | `forms/form-fields.controller.ts` |
| GET | `/admin/forms/fields/:id` | `forms/form-fields.controller.ts` |
| PATCH | `/admin/forms/fields/:id` | `forms/form-fields.controller.ts` |
| GET | `/admin/forms/fields/step/:stepId` | `forms/form-fields.controller.ts` |
| POST | `/admin/forms/fields/step/:stepId` | `forms/form-fields.controller.ts` |
| DELETE | `/admin/forms/steps/:id` | `forms/form-steps.controller.ts` |
| GET | `/admin/forms/steps/:id` | `forms/form-steps.controller.ts` |
| PATCH | `/admin/forms/steps/:id` | `forms/form-steps.controller.ts` |
| GET | `/admin/forms/steps/category/:categoryId` | `forms/form-steps.controller.ts` |
| POST | `/admin/forms/steps/category/:categoryId` | `forms/form-steps.controller.ts` |
| GET | `/admin/logs` | `admin/admin.controller.ts` |
| GET | `/admin/message-notification-logs` | `admin/admin.controller.ts` |
| GET | `/admin/metrics` | `admin/admin.controller.ts` |
| GET | `/admin/moderation/listings` | `admin/admin-moderation.controller.ts` |
| PATCH | `/admin/moderation/listings/status` | `admin/admin-moderation.controller.ts` |
| GET | `/admin/platform-wallet` | `admin/admin.controller.ts` |
| GET | `/admin/platform-wallet/transactions` | `admin/admin.controller.ts` |
| GET | `/admin/platform-wallet/transactions/export` | `admin/admin.controller.ts` |
| GET | `/admin/promotions` | `promotions/promotions.controller.ts` |
| POST | `/admin/promotions` | `promotions/promotions.controller.ts` |
| DELETE | `/admin/promotions/:id` | `promotions/promotions.controller.ts` |
| GET | `/admin/promotions/:id` | `promotions/promotions.controller.ts` |
| PATCH | `/admin/promotions/:id` | `promotions/promotions.controller.ts` |
| PATCH | `/admin/promotions/:id/status` | `promotions/promotions.controller.ts` |
| GET | `/admin/settings` | `admin/admin.controller.ts` |
| GET | `/admin/search/relevance` | `admin/admin.controller.ts` |
| POST | `/admin/search/relevance` | `admin/admin.controller.ts` |
| POST | `/admin/settings` | `admin/admin.controller.ts` |
| POST | `/admin/settings/:key` | `admin/admin.controller.ts` |
| GET | `/admin/zikopay/transactions` | `admin/admin.controller.ts` |
| GET | `/admin/zikopay/transactions/export` | `admin/admin.controller.ts` |

## alerts

| Method | Route | Controller |
|---|---|---|
| GET | `/alerts` | `alerts/alerts.controller.ts` |
| POST | `/alerts` | `alerts/alerts.controller.ts` |
| DELETE | `/alerts/:id` | `alerts/alerts.controller.ts` |
| PATCH | `/alerts/:id` | `alerts/alerts.controller.ts` |

## auth

| Method | Route | Controller |
|---|---|---|
| POST | `/auth/forgot-password` | `auth/auth.controller.ts` |
| POST | `/auth/login` | `auth/auth.controller.ts` |
| POST | `/auth/logout` | `auth/auth.controller.ts` |
| POST | `/auth/register` | `auth/auth.controller.ts` |
| POST | `/auth/reset-password` | `auth/auth.controller.ts` |

## categories

| Method | Route | Controller |
|---|---|---|
| GET | `/categories` | `categories/categories.controller.ts` |
| POST | `/categories` | `categories/categories.controller.ts` |
| DELETE | `/categories/:id` | `categories/categories.controller.ts` |
| GET | `/categories/:id` | `categories/categories.controller.ts` |
| PATCH | `/categories/:id` | `categories/categories.controller.ts` |
| GET | `/categories/:id/form` | `categories/categories.controller.ts` |
| GET | `/categories/slug/:slug` | `categories/categories.controller.ts` |

## dashboard

| Method | Route | Controller |
|---|---|---|
| GET | `/dashboard/overview` | `dashboard/dashboard.controller.ts` |

## deliveries

| Method | Route | Controller |
|---|---|---|
| POST | `/deliveries` | `deliveries/deliveries.controller.ts` |
| POST | `/deliveries/:id/accept` | `deliveries/deliveries.controller.ts` |
| POST | `/deliveries/:id/cancel` | `deliveries/deliveries.controller.ts` |
| GET | `/deliveries/:id/delivery/code` | `deliveries/deliveries.controller.ts` |
| POST | `/deliveries/:id/delivery/confirm` | `deliveries/deliveries.controller.ts` |
| POST | `/deliveries/:id/escrow` | `deliveries/deliveries.controller.ts` |
| POST | `/deliveries/:id/escrow/release` | `deliveries/deliveries.controller.ts` |
| GET | `/deliveries/:id/pickup/code` | `deliveries/deliveries.controller.ts` |
| POST | `/deliveries/:id/pickup/confirm` | `deliveries/deliveries.controller.ts` |
| PATCH | `/deliveries/:id/status` | `deliveries/deliveries.controller.ts` |
| GET | `/deliveries/available` | `deliveries/deliveries.controller.ts` |
| POST | `/deliveries/escrow/init` | `deliveries/deliveries.controller.ts` |
| GET | `/deliveries/listing/:listingId` | `deliveries/deliveries.controller.ts` |
| GET | `/deliveries/mine` | `deliveries/deliveries.controller.ts` |

## favorites

| Method | Route | Controller |
|---|---|---|
| GET | `/favorites` | `favorites/favorites.controller.ts` |
| DELETE | `/favorites/:listingId` | `favorites/favorites.controller.ts` |
| POST | `/favorites/:listingId` | `favorites/favorites.controller.ts` |

## geo

| Method | Route | Controller |
|---|---|---|
| GET | `/geo/autocomplete` | `geo/geo.controller.ts` |
| GET | `/geo/cities` | `geo/geo.controller.ts` |
| GET | `/geo/nearby` | `geo/geo.controller.ts` |
| GET | `/geo/neighborhoods` | `geo/geo.controller.ts` |
| GET | `/geo/reverse` | `geo/geo.controller.ts` |

## health

| Method | Route | Controller |
|---|---|---|
| GET | `/health` | `app.controller.ts` |

## home

| Method | Route | Controller |
|---|---|---|
| GET | `/home` | `home/home.controller.ts` |
| GET | `/home/categories` | `home/home.controller.ts` |
| GET | `/home/hero` | `home/home.controller.ts` |
| GET | `/home/listings` | `home/home.controller.ts` |
| GET | `/home/listings/featured` | `home/home.controller.ts` |
| GET | `/home/listings/latest` | `home/home.controller.ts` |
| GET | `/home/seller-split` | `home/home.controller.ts` |
| GET | `/home/services` | `home/home.controller.ts` |
| GET | `/home/storefronts` | `home/home.controller.ts` |
| GET | `/home/testimonials` | `home/home.controller.ts` |
| GET | `/home/trending-searches` | `home/home.controller.ts` |

## links

| Method | Route | Controller |
|---|---|---|
| GET | `/links/:slug` | `links/links.controller.ts` |
| POST | `/links/shorten` | `links/links.controller.ts` |

## listings

| Method | Route | Controller |
|---|---|---|
| GET | `/listings` | `listings/listings.controller.ts` |
| POST | `/listings` | `listings/listings.controller.ts` |
| DELETE | `/listings/:id` | `listings/listings.controller.ts` |
| GET | `/listings/:id` | `listings/listings.controller.ts` |
| PATCH | `/listings/:id` | `listings/listings.controller.ts` |
| GET | `/listings/:id/export` | `listings/listings.controller.ts` |
| POST | `/listings/:id/images` | `listings/listings.controller.ts` |
| DELETE | `/listings/:id/images/:imageId` | `listings/listings.controller.ts` |
| GET | `/listings/:id/og` | `listings/listings.controller.ts` |
| GET | `/listings/:id/similar` | `listings/listings.controller.ts` |
| PATCH | `/listings/:id/status` | `listings/listings.controller.ts` |
| POST | `/listings/:id/views` | `listings/listings.controller.ts` |
| GET | `/listings/featured` | `listings/listings.controller.ts` |
| GET | `/listings/form-schema/:categoryId` | `listings/listings.controller.ts` |
| GET | `/listings/latest` | `listings/listings.controller.ts` |
| GET | `/listings/me` | `listings/listings.controller.ts` |
| GET | `/listings/pending` | `listings/listings.controller.ts` |
| GET | `/listings/price-suggestion` | `listings/listings.controller.ts` |

## media

| Method | Route | Controller |
|---|---|---|
| POST | `/media/upload` | `media/media.controller.ts` |

## search

| Method | Route | Controller |
|---|---|---|
| GET | `/search/suggestions` | `search-logs/search-logs.controller.ts` |
| GET | `/search/synonyms` | `search-logs/search-logs.controller.ts` |
| POST | `/search/synonyms` | `search-logs/search-logs.controller.ts` |
| DELETE | `/search/synonyms/:id` | `search-logs/search-logs.controller.ts` |

## messages

| Method | Route | Controller |
|---|---|---|
| GET | `/messages/conversations` | `messages/messages.controller.ts` |
| POST | `/messages/conversations` | `messages/messages.controller.ts` |
| GET | `/messages/conversations/:id` | `messages/messages.controller.ts` |
| POST | `/messages/conversations/:id/ai-reply` | `messages/messages.controller.ts` |
| POST | `/messages/conversations/:id/attachments` | `messages/messages.controller.ts` |
| GET | `/messages/conversations/:id/messages` | `messages/messages.controller.ts` |
| POST | `/messages/conversations/:id/messages` | `messages/messages.controller.ts` |
| POST | `/messages/conversations/:id/read` | `messages/messages.controller.ts` |
| GET | `/messages/quick-replies` | `messages/messages.controller.ts` |
| POST | `/messages/quick-replies` | `messages/messages.controller.ts` |
| DELETE | `/messages/quick-replies/:id` | `messages/messages.controller.ts` |
| PATCH | `/messages/quick-replies/:id` | `messages/messages.controller.ts` |

## metrics

| Method | Route | Controller |
|---|---|---|
| GET | `/metrics` | `monitoring/monitoring.controller.ts` |
| GET | `/monitoring/search/status` | `monitoring/monitoring.controller.ts` |
| POST | `/monitoring/search/alerts/dispatch` | `monitoring/monitoring.controller.ts` |

## notifications

| Method | Route | Controller |
|---|---|---|
| GET | `/notifications` | `notifications/notifications.controller.ts` |
| PATCH | `/notifications/:id/read` | `notifications/notifications.controller.ts` |
| PATCH | `/notifications/read-all` | `notifications/notifications.controller.ts` |

## orders

| Method | Route | Controller |
|---|---|---|
| GET | `/orders/:id` | `orders/orders.controller.ts` |
| GET | `/orders/mine` | `orders/orders.controller.ts` |

## payments

| Method | Route | Controller |
|---|---|---|
| POST | `/payments/checkout` | `payments/payments.controller.ts` |
| GET | `/payments/checkout/sessions/:id` | `payments/payments.controller.ts` |
| GET | `/payments/flutterwave/verify` | `payments/payments.controller.ts` |
| POST | `/payments/flutterwave/webhook` | `payments/payments.webhook.controller.ts` |
| GET | `/payments/invoices` | `payments/payments.controller.ts` |
| GET | `/payments/invoices/:id` | `payments/payments.controller.ts` |
| GET | `/payments/methods` | `payments/payments.controller.ts` |
| POST | `/payments/methods` | `payments/payments.controller.ts` |
| DELETE | `/payments/methods/:id` | `payments/payments.controller.ts` |
| PATCH | `/payments/methods/:id` | `payments/payments.controller.ts` |
| POST | `/payments/methods/:id/confirm` | `payments/payments.controller.ts` |
| POST | `/payments/methods/:id/verify` | `payments/payments.controller.ts` |
| POST | `/payments/mtn/init` | `payments/payments.controller.ts` |
| POST | `/payments/mtn/webhook` | `payments/payments.webhook.controller.ts` |
| GET | `/payments/options` | `payments/payments.controller.ts` |
| POST | `/payments/orange/init` | `payments/payments.controller.ts` |
| POST | `/payments/orange/webhook` | `payments/payments.webhook.controller.ts` |
| POST | `/payments/pro-plans` | `payments/payments.controller.ts` |
| GET | `/payments/subscriptions` | `payments/payments.controller.ts` |
| POST | `/payments/subscriptions/:id/cancel` | `payments/payments.controller.ts` |
| POST | `/payments/subscriptions/:id/resume` | `payments/payments.controller.ts` |
| GET | `/payments/wallet` | `payments/payments.controller.ts` |
| POST | `/payments/wallet/topup` | `payments/payments.controller.ts` |
| GET | `/payments/wallet/transactions` | `payments/payments.controller.ts` |
| GET | `/payments/wallet/transactions/export` | `payments/payments.controller.ts` |
| POST | `/payments/wallet/withdraw` | `payments/payments.controller.ts` |
| GET | `/payments/zikopay/verify` | `payments/payments.controller.ts` |
| POST | `/payments/zikopay/webhook` | `payments/payments.webhook.controller.ts` |

## reports

| Method | Route | Controller |
|---|---|---|
| GET | `/reports` | `reports/reports.controller.ts` |
| POST | `/reports` | `reports/reports.controller.ts` |
| PATCH | `/reports/:id` | `reports/reports.controller.ts` |

## reviews

| Method | Route | Controller |
|---|---|---|
| POST | `/reviews` | `reviews/reviews.controller.ts` |
| GET | `/reviews/sellers/:sellerId` | `reviews/reviews.controller.ts` |
| POST | `/reviews/users` | `reviews/reviews.controller.ts` |

## storefronts

| Method | Route | Controller |
|---|---|---|
| GET | `/storefronts/:slug` | `storefronts/storefronts.controller.ts` |
| GET | `/storefronts/:slug/listings` | `storefronts/storefronts.controller.ts` |

## users

| Method | Route | Controller |
|---|---|---|
| GET | `/users` | `users/users.controller.ts` |
| DELETE | `/users/:id` | `users/users.controller.ts` |
| GET | `/users/:id` | `users/users.controller.ts` |
| PATCH | `/users/:id` | `users/users.controller.ts` |
| DELETE | `/users/:id/follow` | `users/users.controller.ts` |
| POST | `/users/:id/follow` | `users/users.controller.ts` |
| GET | `/users/:id/followers/count` | `users/users.controller.ts` |
| PATCH | `/users/:id/pro` | `users/users.controller.ts` |
| GET | `/users/couriers` | `users/users.controller.ts` |
| DELETE | `/users/me` | `users/users.controller.ts` |
| GET | `/users/me` | `users/users.controller.ts` |
| PATCH | `/users/me` | `users/users.controller.ts` |
| GET | `/users/me/addresses` | `users/users.controller.ts` |
| POST | `/users/me/addresses` | `users/users.controller.ts` |
| DELETE | `/users/me/addresses/:id` | `users/users.controller.ts` |
| PATCH | `/users/me/addresses/:id` | `users/users.controller.ts` |
| PATCH | `/users/me/change-password` | `users/users.controller.ts` |
| POST | `/users/me/company-doc` | `users/users.controller.ts` |
| POST | `/users/me/courier-doc` | `users/users.controller.ts` |
| GET | `/users/me/follows` | `users/users.controller.ts` |
| GET | `/users/me/follows/list` | `users/users.controller.ts` |
| POST | `/users/me/identity-docs` | `users/users.controller.ts` |
| DELETE | `/users/me/identity-docs/:documentId` | `users/users.controller.ts` |
| PATCH | `/users/me/settings` | `users/users.controller.ts` |
| PATCH | `/users/me/two-factor` | `users/users.controller.ts` |
| GET | `/users/public/:id` | `users/users.controller.ts` |
| GET | `/users/public/slug/:slug` | `users/users.controller.ts` |
