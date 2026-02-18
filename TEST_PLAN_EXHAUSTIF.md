# Plan De Test Exhaustif (Backend + Frontend)

Ce plan est base sur le code actuel du projet (scan automatique du repo) :
- Backend: `26` controllers, `183` endpoints
- Frontend: `55` routes React, `54` pages

## 1. Objectif
- Verifier toutes les fonctionnalites presentes dans l'application
- Couvrir les parcours critiques de bout en bout
- Eviter les regressions avant mise en production

## 2. Perimetre Fonctionnel Complet

### 2.1 Backend (Controllers et domaines)

1. `app.controller.ts`
- Sante API (`GET /health`)

2. `auth.controller.ts` (`/auth`)
- Inscription, connexion, reset password, logout

3. `users.controller.ts` (`/users`)
- Profil courant (`/me`)
- Parametres utilisateur (`/me/settings`, 2FA, mot de passe)
- Adresses utilisateur (CRUD)
- Identite: upload/suppression docs
- Entreprise: upload doc
- Livreur: upload doc
- Follow/unfollow vendeurs
- Profil public particulier (`/public/:id`, `/public/slug/:slug`)
- Couriers publics (`/couriers`)
- Backoffice users (list, get, patch, pro toggle, delete)

4. `categories.controller.ts` (`/categories`)
- List/get categories
- Get by slug
- Form par categorie
- CRUD admin/moderation

5. `listings.controller.ts` (`/listings`)
- Recherche/listing public
- Schema de formulaire dynamique
- Suggestions de prix
- Featured/latest/me/pending
- Similar listings
- Detail annonce (optional auth)
- Export PDF/OG
- CRUD annonce
- Views
- Changement de statut (admin/moderation)
- Images listing (add/delete)

6. `favorites.controller.ts` (`/favorites`)
- Liste favoris
- Ajouter/supprimer favori

7. `messages.controller.ts` (`/messages`)
- Conversations (liste/detail/messages)
- Creation conversation
- Envoi message
- Mark as read
- Pieces jointes
- IA auto-reply
- Quick replies CRUD

8. `notifications.controller.ts` (`/notifications`)
- Liste notifications
- Mark one read
- Mark all read

9. `alerts.controller.ts` (`/alerts`)
- Alertes utilisateur CRUD

10. `reviews.controller.ts` (`/reviews`)
- Avis vendeur (read)
- Avis classique (post)
- Avis user public (post users)

11. `reports.controller.ts` (`/reports`)
- Signalement (post)
- Liste/admin moderation (get)
- Traitement signalement (patch)

12. `storefronts.controller.ts` (`/storefronts`)
- Vitrine publique par slug
- Listings de vitrine

13. `home.controller.ts` (`/home`)
- Donnees page accueil:
  hero, categories, services, listings, featured/latest, testimonials, trending, storefronts

14. `dashboard.controller.ts` (`/dashboard`)
- Overview dashboard utilisateur connecte

15. `payments.controller.ts` (`/payments`)
- Methodes paiement CRUD + verification
- Invoices
- Checkout pro
- MTN init
- Orange init
- Session checkout
- Pro plans + subscriptions cancel/resume
- Wallet: summary, transactions, export CSV, topup, withdraw
- Verification providers (`zikopay/verify`, `flutterwave/verify`)

16. `payments.webhook.controller.ts` (`/payments`)
- Webhooks MTN, Orange, Flutterwave, Zikopay

17. `deliveries.controller.ts` (`/deliveries`)
- Courses disponibles
- Mes livraisons
- Livraison par listing
- Creation livraison
- Init escrow
- Accept livraison
- Escrow request/release
- Pickup code get/confirm
- Delivery code get/confirm
- Update status
- Cancel

18. `orders.controller.ts` (`/orders`)
- Mes commandes
- Detail commande

19. `media.controller.ts` (`/media`)
- Upload media authentifie

20. `links.controller.ts` (`/links`, `/s`)
- Raccourcisseur de lien
- Redirection lien court

21. `promotions.controller.ts` (`/admin/promotions`)
- CRUD promotions admin/moderation + status

22. `admin.controller.ts` (`/admin`)
- Metrics, activities, logs
- Settings
- Message notification logs
- Company verifications
- Courier verifications
- Platform wallet + transactions + export
- Zikopay transactions + export
- Audit scope

23. `admin-moderation.controller.ts` (`/admin/moderation`)
- Listings moderation list
- Listings status patch

24. `admin-export.controller.ts` (`/admin/export`)
- Creation job export
- Etat job
- Download export

25. `form-steps.controller.ts` (`/admin/forms/steps`)
- CRUD et listing steps de formulaire

26. `form-fields.controller.ts` (`/admin/forms/fields`)
- CRUD et listing fields de formulaire

### 2.2 Frontend (Routes/pages)

#### Public
- `/`
- `/listing/:id`
- `/search`
- `/store/:slug`
- `/stores`
- `/user/:id`
- `/u/:slug`
- `/about`, `/contact`, `/terms`, `/privacy-policy`, `/faq`
- `/maintenance`, `/500`, `*`

#### Auth
- `/login`
- `/register`
- `/forgot-password`
- `/reset-password`
- `/auth/logout`

#### Listing/Checkout
- `/listings/new` (auth)
- `/listings/edit/:id`
- `/listing/:id/checkout` (auth)
- `/payment/return` (auth)

#### Dashboard
- `/dashboard`
- `/dashboard/overview` (pro + feature flag)
- `/dashboard/promotions` (pro + feature flag)
- `/dashboard/listings`
- `/dashboard/follows`
- `/dashboard/favorites`
- `/dashboard/alerts`
- `/dashboard/deliveries`
- `/dashboard/orders`
- `/dashboard/messages` (pro + feature flag)
- `/dashboard/messages/:id` (pro + feature flag)
- `/dashboard/profile`
- `/dashboard/settings`
- `/dashboard/wallet`
- `/dashboard/payments` (pro + feature flag)
- `/dashboard/pro` (pro + feature flag)

#### Admin
- `/admin` (admin + feature flag)
- `/admin/listings`
- `/admin/users`
- `/admin/company-verifications`
- `/admin/courier-verifications`
- `/admin/platform-wallet`
- `/admin/zikopay-transactions`
- `/admin/reports`
- `/admin/categories`
- `/admin/categories/new`
- `/admin/categories/:id/form`
- `/admin/promotions`
- `/admin/logs`
- `/admin/notification-logs`
- `/admin/settings`

#### Feature flags detectes
- `proOverview`, `proMessaging`, `proPayments`, `proPortal`, `proPromotions`
- `adminConsole`, `adminSettings`, `adminPromotions`, `adminLogs`

## 3. Plan De Test Exhaustif (Suites)

## Suite A - Authentification et Session
1. Register user standard/pro
2. Login OK/KO
3. Forgot/reset password
4. Logout
5. Acces routes protegees (auth manquante)
6. Expiration token / token invalide

## Suite B - Users, Profil, Settings, Privacy
1. Lecture/modification profil
2. Parametres (notifications, location privacy, preferences)
3. 2FA enable/disable
4. Changement mot de passe
5. Adresses CRUD
6. Upload/suppression identite
7. Upload doc entreprise
8. Upload doc livreur
9. Delete account
10. Profil public particulier (id + slug)
11. Follow/unfollow + followers count + listing follows
12. Liste couriers publics

## Suite C - Categories et Form Builder
1. Liste categories
2. Get categorie par slug/id
3. Form categorie
4. CRUD categories (roles admin/moderator)
5. Form steps CRUD
6. Form fields CRUD
7. Validation rules (mandatory/regexp/options)

## Suite D - Listings
1. Creation annonce (fields, rights, ad_types)
2. Edition annonce
3. Suppression annonce
4. Upload/suppression images
5. Search/list filters/sort/pagination
6. Featured/latest/similar
7. Detail annonce (viewer auth vs guest)
8. Views increment
9. Statut listing moderation/admin
10. Export PDF + OG endpoint
11. Form schema endpoint
12. Price suggestion endpoint

## Suite E - Favoris, Alerts, Notifications
1. Favoris add/remove/list
2. Alerts CRUD
3. Notifications list/read/read-all
4. Cohesion notif in-app lors d'actions critiques

## Suite F - Messaging
1. Creation conversation
2. Envoi message texte
3. Historique messages
4. Mark as read + unread counters
5. Attachments
6. Quick replies CRUD
7. IA auto-reply (enabled/disabled/rate-limit)
8. Permissions participant (buyer/seller/courier)

## Suite G - Reviews et Reports
1. Lecture avis vendeur
2. Ajout avis user
3. Ajout avis vendeur (si applicable)
4. Signalement annonce/utilisateur
5. Backoffice moderation reports (list + patch)

## Suite H - Storefront et Home
1. Storefront public par slug
2. Listings storefront
3. Persistance image profil/couverture
4. Donnees home: hero/categories/services/listings/testimonials/trending

## Suite I - Paiements et Wallet
1. Payment methods CRUD + verify
2. Invoices list/detail
3. Checkout pro et session
4. Subscriptions list/cancel/resume
5. MTN init / Orange init
6. Verify Zikopay / Flutterwave
7. Wallet summary
8. Wallet transactions + filtres
9. Wallet export CSV
10. Topup wallet
11. Withdraw wallet
12. Erreurs provider (config manquante, provider KO)
13. Webhooks providers (mtn/orange/flutterwave/zikopay)

## Suite J - Livraison et Commandes (Escrow)
1. Creation livraison
2. Init escrow
3. Available deliveries
4. Acceptation livreur
5. Pickup code flow
6. Delivery code flow
7. Release escrow
8. Cancel delivery
9. Update status guardrails
10. Commandes: mine/detail
11. Distribution montants vendeur/livreur/commission plateforme
12. Modes remise (delivery/pickup)

## Suite K - Admin Console
1. Metrics/activities/logs/audit
2. Admin settings (read/write)
3. Moderation listings
4. Admin users (list/get/update/pro/delete)
5. Company verifications
6. Courier verifications
7. Platform wallet + tx + export
8. Zikopay transactions + export
9. Promotions admin CRUD/status
10. Message notification logs
11. Export jobs (create/status/download)

## Suite L - Liens courts et Media
1. `/links/shorten`
2. `/s/:slug` redirection
3. `/media/upload` (auth, types tailles)

## 4. Tests Frontend (UI + Navigation + Guards)
1. Toutes les routes publiques
2. Routes dashboard exigeant auth
3. Routes pro exigeant pro + feature flag
4. Routes admin exigeant admin + feature flag
5. Redirections automatiques:
- non auth -> `/login`
- admin -> `/admin` si tente route user
- non admin -> `/dashboard` si tente admin
- non pro -> `/dashboard` si tente route pro
6. Etats erreur/chargement (RetryBanner, Skeleton)

## 5. Integrations externes a couvrir
1. Paiement: MTN, Orange, Zikopay, Flutterwave (selon provider actif)
2. SMS: Twilio (code livraison/reception)
3. Email: SendGrid
4. Geocodage/Map: Mapbox
5. Stockage media: local/S3/Minio

## 6. Non-fonctionnel et securite
1. RBAC (user/pro/admin/moderator)
2. Validation DTO + erreurs 4xx propres
3. Concurrence (double accept livraison, double release escrow, double payment init)
4. Idempotence webhooks
5. Logs d'audit et traces
6. Perf critique:
- search listings
- messages pagination
- wallet transactions export

## 7. Ordre d'implementation recommande (automatisation)
1. P0:
- Auth, Users Settings, Listings CRUD/Search
- Payments Wallet, Deliveries Escrow, Orders
- Messages, Notifications
2. P1:
- Storefront/Home, Reviews/Reports, Links/Media
- Admin verifications + platform wallet
3. P2:
- Promotions, export jobs, logs avancés, static pages

## 8. Commandes cibles (a mettre en place)
- `npm run test:flow:auth`
- `npm run test:flow:users`
- `npm run test:flow:listings`
- `npm run test:flow:messages`
- `npm run test:flow:payments`
- `npm run test:flow:delivery`
- `npm run test:flow:admin`
- `npm run test:flow:public`
- `npm run test:flows` (orchestrateur global)

