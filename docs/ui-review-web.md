# Revue UI Web — sandaga-frontend

Revue exhaustive feature-par-feature (multi-agent, chaque finding vérifié de façon adverse). **128 findings confirmés** — 🔴 0 critical · 🟠 1 high · 🟡 45 medium · ⚪ 82 low. Axes : Bug 43 · UX 58 · Visuel 16 · API 11. **17/17 unités couvertes.**

---

# Synthèse exécutive — Revue UI sandaga-frontend

## 1. Verdict global

L'UI est **fonctionnellement aboutie mais inégale dans son exécution** : aucun défaut critique ou bloquant (0 critical/high), mais une dette transverse marquée sur l'internationalisation, la gestion d'erreur réseau et la cohérence du design system. La base est saine ; les corrections relèvent du durcissement et de l'homogénéisation, pas de la refonte.

## 2. Thèmes transverses récurrents

| Thème | Findings | Fonctionnalités touchées | Symptôme |
|---|---|---|---|
| **Texte FR codé en dur (hors i18n)** | ~28 | admin-catalog, admin-monitoring, auth, dash-account, dash-buying, dash-messaging, dash-money, listing-detail, search (~13) | Sections entières non traduisibles (Wallet, Orders, Checkout, SearchRelevance, PlatformWallet…) |
| **Gestion d'erreur réseau fragile** | ~12 | dash-buying, dash-money, home, listing-detail, dash-overview | Erreurs réduites à un toast, aucun retry, pas d'état d'erreur persistant ; actions sans try/catch (Deliveries) |
| **Réinvention de composants / design system** | ~11 | dash-selling, dash-messaging, dash-money, admin-monitoring, listing-detail, static | Modales inline sans a11y, boutons/chips réinventés, couleurs hex hardcodées, `window.prompt`/`window.confirm` |
| **Cycle de vie React non maîtrisé** | ~10 | dash-money, admin-monitoring, listing-detail, auth, listing-create | Pas d'AbortController, double-appel au montage, setState après démontage, `URL.createObjectURL`/Mapbox non libérés |
| **Accessibilité incomplète** | ~9 | home, design-system, static, dash-selling | Labels non liés aux inputs, Modal sans Escape/focus-trap/scroll-lock, ARIA combobox incomplet, sauts de niveau de titre |
| **Code mort / câblage incomplet** | ~8 | home, dash-buying, dash-overview, dash-selling, listing-detail | Logique follow/unfollow non branchée, avis vendeur jamais affichés, deep-links ignorés, composants jamais routés |

## 3. Top priorités (regroupées par thème)

Aucun critical/high, mais les **clusters à plus fort risque utilisateur** à traiter en premier :

1. **Sécurité & routage** — deux corrections rapides et sensibles :
   - Route `/listings/edit/:id` non protégée alors que `/new` l'est (`AppRouter.tsx:162`).
   - Rôle `moderator` mal redirigé (login envoie `/admin`, guard renvoie `/dashboard`) (`Login.tsx:43`).

2. **Robustesse des flux argent/livraison** — là où un échec silencieux coûte cher :
   - Actions Deliveries (accept, confirm, release, codes) **sans aucun try/catch** (`Deliveries.tsx:61`).
   - Polling `PaymentReturn` figé sur erreur réseau, vérification stoppée (`PaymentReturn.tsx:79`).
   - Wallet/PlatformWallet : double-appel + boucle potentielle + absence d'AbortController (`Wallet.tsx:130`, `PlatformWallet.tsx:102`).
   - Checkout : paiement wallet autorisé sans contrôle de solde si le wallet n'a pas chargé (`ListingCheckout.tsx:336`) et fuite Mapbox (`:269`).

3. **Bugs fonctionnels visibles** — fonctionnalités qui semblent marcher mais ne font rien :
   - Avis vendeur chargés/soumis mais **jamais rendus** (`ListingDetail.tsx:316`).
   - Formulaire de contact **sans `onSubmit`** : recharge la page et perd les données (`Contact.tsx:27`).
   - Bouton « Créer une alerte » inerte en état vide (`SearchResultsList.tsx:124`).
   - Deep-link promotion `?listingId=` jamais lu (`Promotions.tsx:274`).
   - Export PDF : `fetch` relatif sans `API_BASE_URL` ni token (`ListingDetail.tsx:637`).

## 4. Quick wins (faible effort, fort impact)

- **Durcir le composant `Modal` partagé une fois** (Escape + focus-trap + scroll-lock + `id` non collisionnant) : corrige d'un coup `Modal.tsx:16/32` et donne une cible pour remplacer toutes les modales/`window.prompt`/`window.confirm` réinventés.
- **`<html lang>` synchronisé au changement de locale** (`I18nContext.tsx:49`) — une ligne, gain a11y/SEO global.
- **Titre de document sur les pages statiques** (`About.tsx:18` + FAQ/CGU/Confidentialité) — SEO/onglets.
- **Brancher le `onSubmit` du formulaire de contact** + ajouter `required`/`aria-required` (`Contact.tsx:27/29`).
- **Nettoyer le code mort** : `DashboardOverview` (jamais routé), follow/unfollow non câblé sur Home, imports morts Favorites — réduit le bruit sans risque.
- **Supprimer les `console.log` de production** (`NewListing.tsx:1564`) et révoquer les `createObjectURL` (`ImagesManager.tsx:133`).
- **Remplacer `window.location.assign` par le routeur SPA** (`Categories.tsx:276`, `useMessageNotifications.ts:70`) — évite les full reloads.
- **Plan i18n par lot** : les ~28 chaînes en dur sont concentrées sur quelques écrans (Wallet, Orders, Checkout, Deliveries, admin-monitoring) — un sprint d'extraction ciblé écran par écran épuise la majorité de la dette UX.

> **Addendum — 2 unités complétées dans un 2ᵉ passage :** *Boutiques & profil public* (8) et *Admin — modération & vérifications* (10). Point saillant : `PublicProfile.tsx` est intégralement hors i18n (texte FR/EN ad hoc, helpers monolingues) et son bouton « Suivre » est inerte (disabled, sans handler) alors que `Storefront.tsx` implémente un follow fonctionnel.

---

## Détail des findings par fonctionnalité

### Boutiques & profil public  ·  8 findings (🟠1 🟡1 ⚪6)

#### 🟠 PublicProfile : tout le texte visible est en dur (FR/EN ad hoc), pas d'i18n
*high · UX/A11y · confiance high* — `src/pages/Users/PublicProfile.tsx:132`

Contrairement à Storefront.tsx et Storefronts.tsx qui utilisent useI18n()/t(), PublicProfile n'importe jamais useI18n. La locale est lue via document.documentElement.lang (ligne 132) et toutes les chaînes sont codées en dur, soit en français pur (« Suivre », « En vente », « Vendu », « Laisser un avis », « Aucune annonce en vente pour le moment. », « Signaler cet utilisateur », « Lien copié », « avis », « vendeurs suivis », « Membre depuis »...), soit via des ternaires locale==='fr' éparpillés dans des helpers (formatLastActive, resolveOnlineLabel). formatResponseTime/formatResponseRate (lignes 100-114) ne sont QUE français, donc en EN l'utilisateur voit du français. C'est incohérent avec le reste de la feature et casse l'i18n.

**Correctif suggéré :** Importer useI18n(), remplacer document.documentElement.lang par le locale du contexte, et router toutes les chaînes via t() (ajouter les clés manquantes type 'profile.*' dans translations.ts). Au minimum traduire formatResponseTime/formatResponseRate qui sont actuellement monolingues.

#### 🟡 Bouton « Suivre » du profil public est inerte (disabled, sans handler)
*medium · UX/A11y · confiance high* — `src/pages/Users/PublicProfile.tsx:505`

Le bouton principal d'action <Button className="user-public__follow" variant="outline" disabled>Suivre</Button> est toujours disabled et n'a aucun onClick. Storefront.tsx implémente pourtant un follow fonctionnel via useFollowedSellers (followSeller/unfollowSeller). Sur le profil public, l'action clé est donc morte sans aucune explication, ce qui est déroutant (l'utilisateur clique, rien ne se passe).

**Correctif suggéré :** Câbler le bouton avec useFollowedSellers comme dans Storefront.tsx (gérer auth/redirection /login, état isFollowing, maj optimiste), ou le masquer tant que la fonctionnalité n'est pas disponible plutôt que d'afficher un bouton désactivé.

#### ⚪ Onglet « Vendu » mappé sur status=archived (pas de statut 'sold')
*low · Bug/Logique · confiance high* — `src/pages/Users/PublicProfile.tsx:565`

L'onglet est libellé « Vendu » mais l'état correspondant est tab='archived' (ligne 562-566) et la requête envoie status=archived (ligne 214). ListingStatus (src/types/listing-status.ts) ne contient pas 'sold' : les valeurs sont draft|pending|published|rejected|expired|archived. Une annonce archivée n'est pas forcément vendue (elle peut être expirée, retirée, modérée). Le libellé induit l'utilisateur en erreur et le compteur/contenu de l'onglet est sémantiquement faux.

**Correctif suggéré :** Clarifier la sémantique avec le backend : si un vrai statut 'sold' existe, l'utiliser ; sinon renommer l'onglet en « Archivées » / « Inactives » pour refléter status=archived.

#### ⚪ Labels « Suivre/Suivi/abonnés » en dur dans Storefront au lieu de t()
*low · UX/A11y · confiance high* — `src/pages/Storefront/Storefront.tsx:209`

Storefront utilise l'i18n partout sauf pour le suivi : followersLabel = locale === 'fr' ? 'abonnés' : 'followers' (ligne 209) et le libellé du bouton ligne 334 (locale==='fr' ? 'Suivi':'Following' / 'Suivre':'Follow'). C'est un mélange incohérent : ces chaînes contournent le système t() alors que des clés existent pour tout le reste de la page, ce qui complique la maintenance et la cohérence des traductions.

**Correctif suggéré :** Ajouter des clés (ex. storefront.actions.follow / following / followers) dans translations.ts et passer par t().

#### ⚪ Effet reviews du Storefront : t dans listings deps mais absent ici, et summary potentiellement non nullée
*low · API/Data · confiance high* — `src/pages/Storefront/Storefront.tsx:199`

reviewStats (ligne 199-207) appelle reviewsSummary.averageRating.toFixed(1) en supposant averageRating numérique. Si l'API renvoie un summary partiel (averageRating null/absent quand totalReviews=0), .toFixed plante. positiveCount/negativeCount/successfulSales sont gardés par ?? mais pas averageRating. Par ailleurs l'effet listings (ligne 129) dépend de t alors que t ne sert qu'au message d'erreur ; à chaque changement de locale cela déclenche un refetch complet des annonces (idem effet storefront ligne 91). Coût réseau inutile.

**Correctif suggéré :** Garder averageRating : (reviewsSummary.averageRating ?? 0).toFixed(1). Sortir t des deps des effets de fetch (le lire via ref ou n'utiliser t qu'au rendu) pour éviter les refetch au switch de langue.

#### ⚪ onRetry des bannières d'erreur fait window.location.reload()/assign au lieu d'un vrai retry
*low · UX/A11y · confiance high* — `src/pages/Storefront/Storefronts.tsx:80`

Sur erreur, RetryBanner.onRetry appelle window.location.reload() (Storefronts ligne 80, Storefront lignes 283) ou window.location.assign('/') (lignes 244, 290). Un rechargement complet de page va à l'encontre d'une SPA (perte d'état, flash blanc) alors que les fetch sont déjà encapsulés dans des useEffect réexécutables. Idem dans PublicProfile (lignes 390, 416). UX dégradée et inutile.

**Correctif suggéré :** Extraire la logique de fetch dans une fonction loadX() appelable et passer onRetry={loadX} (avec un compteur/retryKey en state pour relancer l'effet) au lieu de recharger la page.

#### ⚪ Avatar/cover en background-image sans texte alternatif ni rôle (a11y)
*low · UX/A11y · confiance high* — `src/pages/Storefront/Storefront.tsx:297`

Le hero (ligne 295) et surtout l'avatar de la boutique (ligne 297-304) sont rendus comme <div style={{backgroundImage}}> sans alt ni aria-label. Dans Storefronts.tsx l'avatar utilise correctement <img alt={storefront.name}> (ligne 114), mais la version détail perd cette info pour les lecteurs d'écran. Incohérence d'accessibilité entre les deux écrans pour le même contenu (identité de la boutique).

**Correctif suggéré :** Ajouter role="img" + aria-label={storefront.name} sur le div avatar (et un aria-hidden sur le hero purement décoratif), ou réutiliser <img alt> comme dans Storefronts.tsx.

#### ⚪ Type PublicUserProfile déclaré localement au lieu de src/types/user.ts
*low · API/Data · confiance high* — `src/pages/Users/PublicProfile.tsx:18`

Le type du profil public (et celui des reviews lignes 146-152, 246) est défini inline dans le composant. La consigne d'architecture veut que les types vivent dans src/types/*.ts (user.ts ne contient qu'AdminUser/UpdateUserPayload). Storefront.tsx réutilise bien des types partagés (Review, SellerReviewsResponse) ; PublicProfile redéfinit un shape de review divergent ({reviewer:{name}} sans location/createdAt côté Storefront), source d'incohérences de typage entre les deux écrans qui consomment pourtant /reviews/sellers/:id.

**Correctif suggéré :** Déplacer PublicUserProfile dans src/types/user.ts et réutiliser Review/SellerReviewsResponse de src/types/review.ts pour les avis, afin d'aligner le typage entre Storefront et PublicProfile.

---

### Détail annonce & checkout  ·  12 findings (🟡7 ⚪5)

#### 🟡 Export PDF: fetch relatif sans API_BASE_URL ni token d'auth
*medium · API/Data · confiance high* — `src/pages/Listings/ListingDetail.tsx:637`

handleExportPdf appelle fetch(`/listings/${listing.id}/export`) en chemin relatif au lieu de passer par la couche utils/api.ts. Conséquences: (1) la requête part vers l'origine du frontend, pas vers API_BASE_URL — en prod/dev où l'API est sur un autre host/port, l'URL est fausse; (2) aucun header Authorization Bearer n'est ajouté (api.ts l.46 l'injecte automatiquement), donc un export protégé renverra 401/403; (3) aucun cookie/credentials:'include'. Le reste du fichier utilise systématiquement apiGet/apiPost.

**Correctif suggéré :** Construire l'URL avec getApiUrl('/listings/'+listing.id+'/export') et ajouter les en-têtes d'auth (Authorization: Bearer getAuthToken()) + credentials:'include', ou exposer un helper apiGetBlob dans utils/api.ts qui réutilise la logique d'en-têtes existante.

#### 🟡 Avis vendeur chargés et soumis mais jamais affichés dans le JSX
*medium · Bug/Logique · confiance high* — `src/pages/Listings/ListingDetail.tsx:316`

Tout le sous-système d'avis est câblé côté logique: états reviews/reviewSummary/reviewsLoading/reviewsError/reviewForm/isSubmittingReview, loadReviews() (l.377), handleSubmitReview() (l.515), hasReviewed (l.772) et un effet GET /reviews/sellers/:id (l.388). Mais le rendu (à partir de l.1086) ne contient AUCUNE section d'avis ni formulaire: aucune occurrence de reviews/reviewForm/reviewSummary après le return. Les clés i18n existent (listings.detail.reviews.* l.2038+). Résultat: requête réseau exécutée à chaque chargement pour rien, fonctionnalité visible attendue absente, code mort.

**Correctif suggéré :** Soit rendre la section avis (liste reviews avec key=review.id, résumé reviewSummary, états loading/error/empty, formulaire conditionné par isAuthenticated && !isSeller && !hasReviewed), soit supprimer tout le code mort associé pour éviter l'appel /reviews inutile.

#### 🟡 Page checkout entièrement en français codé en dur (hors i18n)
*medium · UX/A11y · confiance high* — `src/pages/Listings/ListingCheckout.tsx:422`

ListingCheckout.tsx n'importe pas useI18n et tout le texte visible est en dur: titres ('Finaliser l’achat', 'Mode de remise', 'Trouver un livreur', 'Informations personnelles'), labels FormField ('Nom complet', 'Téléphone', 'Adresse de livraison'), placeholders, options de paiement ('Mobile Money', 'Carte bancaire', 'Wallet interne'), messages d'erreur wallet ('Solde insuffisant…'), boutons ('Payer en sécurisé', 'Traitement...'), et les toasts (title 'Achat', messages). Idem PaymentReturn.tsx (titres et toasts en dur). L'app impose le passage par i18n; en mode 'en' la page reste en français.

**Correctif suggéré :** Importer useI18n et remplacer chaque chaîne visible par t('...') avec des clés ajoutées dans src/i18n/translations.ts (fr+en), comme c'est fait dans ListingDetail.

#### 🟡 Libellés codés en dur dans ListingDetail (statuts, actions, présence)
*medium · UX/A11y · confiance high* — `src/pages/Listings/ListingDetail.tsx:1438`

Plusieurs chaînes visibles échappent à l'i18n alors que le reste du fichier l'utilise: 'En ligne'/'Hors ligne' (l.1438), boutons 'Acheter'/'En cours' (l.1471, l.1627), 'Suivi'/'Suivre' (l.1476), 'Remise:'/'Livraison:' (l.1460), 'Paiement en attente de confirmation' (l.1484), 'Confirmer la réception' (l.1513), toast 'Paiement sécurisé'/'Impossible de libérer le paiement.' (l.1507-1508), modale payout entièrement en dur (l.1708-1715), et les statusMap/escrowMap de formatDeliveryLabel (l.219-231).

**Correctif suggéré :** Externaliser ces chaînes via t('...') et ajouter les clés correspondantes (fr/en). Pour formatDeliveryLabel, passer t en paramètre comme buildDefaultHighlights le fait déjà.

#### 🟡 PaymentReturn: erreur réseau pendant le polling fige le spinner et stoppe la vérification
*medium · Bug/Logique · confiance high* — `src/pages/Payments/PaymentReturn.tsx:79`

Dans verify(), le bloc catch (l.79-82) se contente de setStatus('pending') sans relancer de timeout ni positionner isPolling à false. Quand apiGet échoue (réseau coupé, 500), aucun setTimeout(verify) n'est reprogrammé: le polling s'arrête définitivement, mais isPolling reste true (jamais remis à false dans ce chemin), donc le spinner (l.138) tourne indéfiniment et le bloc 'Toujours en attente…' (l.144, gardé par !isPolling) ne s'affiche jamais. L'utilisateur est bloqué sur un état pending sans feedback ni reprise automatique.

**Correctif suggéré :** Dans le catch, incrémenter attemptsRef et, si < maxAttempts, reprogrammer pollTimeoutRef = setTimeout(verify, 4000); sinon setIsPolling(false). Distinguer aussi un état d'erreur réseau explicite pour informer l'utilisateur.

#### 🟡 Checkout: instance Mapbox jamais détruite (fuite de ressource)
*medium · Bug/Logique · confiance high* — `src/pages/Listings/ListingCheckout.tsx:269`

L'effet d'initialisation de la carte (l.269-287) crée mapRef.current via import dynamique mais ne retourne aucune fonction de cleanup. À la navigation hors checkout (ou si referenceCoords change après création), map.remove() n'est jamais appelé: l'instance Mapbox, son canvas WebGL et ses écouteurs fuient. Seuls les markers sont nettoyés (l.293). Sur des allers-retours répétés vers le checkout cela accumule des contextes WebGL.

**Correctif suggéré :** Ajouter un cleanup au démontage du composant: useEffect(() => () => { mapRef.current?.remove(); mapRef.current = null }, []). Et gérer le cas referenceCoords qui change après init (recentrer plutôt que recréer).

#### 🟡 Checkout: pas d'état de chargement ni garde quand l'annonce échoue à charger
*medium · UX/A11y · confiance high* — `src/pages/Listings/ListingCheckout.tsx:417`

L'état 'loading' est calculé (l.74, l.102/114) mais jamais utilisé dans le rendu: pendant le chargement ou en cas d'échec (listing null), la page affiche quand même tout le formulaire de checkout avec 'Annonce' en titre fallback (l.693) et un prix '--', laissant l'utilisateur saisir des données pour une annonce inexistante. canSubmit bloque la soumission mais aucun feedback (skeleton, message d'erreur, EmptyState/RetryBanner) n'est montré. Un toast d'erreur est émis mais l'écran reste un formulaire vide trompeur.

**Correctif suggéré :** Afficher un Skeleton/LoadingOverlay pendant loading, et un EmptyState + bouton retour à l'annonce quand !loading && !listing, en réutilisant les composants src/components/ui (EmptyState, RetryBanner, Skeleton).

#### ⚪ Checkout: paiement wallet autorisé sans contrôle de solde si le wallet n'a pas chargé
*low · Bug/Logique · confiance high* — `src/pages/Listings/ListingCheckout.tsx:336`

canSubmit ne vérifie le solde que si walletSummary est truthy (l.336 'if (paymentMethod === "wallet" && walletSummary)'). L'effet l.119-125 met walletSummary à null en cas d'échec du GET /payments/wallet. Donc si la requête wallet échoue (ou n'est pas encore résolue), l'utilisateur peut sélectionner 'Wallet interne' et soumettre: aucune vérification de devise ni de solde n'est appliquée côté front, et aucun message ne lui indique que le solde est inconnu. Le bouton 'Payer en sécurisé' reste actif.

**Correctif suggéré :** Si paymentMethod === 'wallet' et walletSummary === null, retourner false dans canSubmit (et afficher un message 'Solde wallet indisponible'). Gérer aussi l'état de chargement du wallet pour ne pas valider avant résolution.

#### ⚪ Checkout: coordonnées de référence rejetées si lat/lng valent 0
*low · Bug/Logique · confiance high* — `src/pages/Listings/ListingCheckout.tsx:174`

referenceCoords (l.174-177) utilise 'if (!locationData?.lat || !locationData?.lng) return null'. courierDistances (l.196) fait de même: 'if (courier.lat && courier.lng)'. Une coordonnée légitime de 0 (équateur / méridien de Greenwich) est traitée comme absente, ce qui désactive carte, calcul de distance et estimation de frais. Le test correct doit distinguer 0 de null/undefined.

**Correctif suggéré :** Remplacer par des tests explicites de nullité + finitude: typeof lat === 'number' && Number.isFinite(lat) (idem lng), comme parseCoordinate le fait déjà dans ListingDetail.

#### ⚪ PaymentReturn / orders: navigation 'Voir mes commandes' sans garantie de commande existante
*low · UX/A11y · confiance high* — `src/pages/Listings/ListingCheckout.tsx:380`

Après /deliveries/escrow/init, si response.paymentUrl existe il est ouvert via window.open(..., '_blank') (l.381). Si le navigateur bloque le popup (comportement courant hors interaction directe asynchrone), l'utilisateur ne voit jamais la page de paiement et est juste redirigé vers /payment/return en attente, sans lien de secours vers paymentUrl. Aucun fallback (lien cliquable / redirection same-tab) n'est proposé.

**Correctif suggéré :** Vérifier la valeur de retour de window.open; si null (popup bloqué), proposer un lien explicite vers response.paymentUrl ou faire window.location.assign(paymentUrl) en dernier recours, et afficher ce lien sur PaymentReturn.

#### ⚪ Avatar vendeur: champ avatarUrl du type jamais utilisé, div vide affichée
*low · Visuel · confiance high* — `src/pages/Listings/ListingDetail.tsx:1421`

ListingOwner.avatarUrl existe dans src/types/listing.ts (l.25) mais l'encart vendeur rend un <div className="listing-agent__avatar" /> systématiquement vide (l.1421 et l.1423), sans <img src={listing.owner.avatarUrl}>. L'avatar réel du vendeur n'est jamais affiché alors que la donnée est disponible.

**Correctif suggéré :** Rendre <img src={listing.owner.avatarUrl} alt={ownerName}> quand avatarUrl est présent, avec fallback initiales/placeholder sinon (comme courier-card__avatar le fait dans le checkout).

#### ⚪ ListingDetail: GET /deliveries/listing/:id sans AbortController (condition de course)
*low · Bug/Logique · confiance high* — `src/pages/Listings/ListingDetail.tsx:434`

L'effet qui charge deliveryInfo (l.434-442) ne crée pas d'AbortController contrairement aux autres effets du fichier. En cas de changement rapide de listingId (ou démontage), la réponse d'un ancien listing peut résoudre après et écraser setDeliveryInfo avec des données d'une autre annonce (race / setState après unmount).

**Correctif suggéré :** Reprendre le pattern des autres effets: créer un AbortController, passer { signal } à apiGet, ignorer l'AbortError dans le catch et abort() au cleanup.

---

### Admin — modération & vérifications  ·  10 findings (🟡4 ⚪6)

#### 🟡 Changer le statut d'un signalement écrase les notes en cours d'édition
*medium · Bug/Logique · confiance high* — `src/pages/Admin/Reports.tsx:161`

handleStatusChange envoie `resolutionNotes: report.resolutionNotes` (la valeur persistée de l'item de liste), pas l'état `resolutionNotes` du panneau de détail. Si l'admin tape une note dans le textarea du détail puis change le statut via le Select de la ligne, le PATCH renvoie l'ancienne note et la réponse `updated` réinitialise le textarea (ligne 168 `setResolutionNotes(updated.resolutionNotes ?? '')`), perdant silencieusement la saisie. De plus, le Select de statut sur chaque ligne déclenche une mutation immédiate sans aucune confirmation, ce qui est dangereux pour des transitions comme `resolved`/`dismissed`.

**Correctif suggéré :** Si la ligne sélectionnée est en cours d'édition, préserver `resolutionNotes` local (ex: `selectedReport?.id === report.id ? resolutionNotes.trim() || undefined : report.resolutionNotes ?? undefined`). Idéalement, confirmer les transitions terminales et/ou ne pas réinitialiser le textarea si l'utilisateur a des modifications non sauvegardées.

#### 🟡 Recherche des vérifications sans debounce : une requête réseau par frappe
*medium · API/Data · confiance high* — `src/pages/Admin/CompanyVerifications.tsx:77`

loadVerifications dépend de `search` et est rappelé par le useEffect à chaque changement de `loadVerifications`, donc chaque caractère tapé dans le champ de recherche déclenche un appel `/admin/company-verifications`. Aucune temporisation contrairement à ListingsModeration qui debounce correctement (350 ms). Idem dans CourierVerifications.tsx (même structure, mêmes lignes). Cela génère une rafale de requêtes et des résultats potentiellement désordonnés (race : aucune annulation de la requête précédente).

**Correctif suggéré :** Introduire un état `debouncedSearch` avec setTimeout/clearTimeout (comme dans ListingsModeration) et baser loadVerifications sur `debouncedSearch`. Ajouter un AbortController/signal (apiGet accepte `signal`) pour annuler la requête précédente et éviter les races.

#### 🟡 Users charge toutes les pages en boucle et filtre côté client
*medium · API/Data · confiance high* — `src/pages/Admin/Users.tsx:59`

fetchAllUsers itère `/users?page=N&limit=100` jusqu'à tout agréger en mémoire, puis la recherche est faite côté client (filteredUsers, ligne 127). Sur une base d'utilisateurs conséquente, cela enchaîne de nombreux appels au montage et charge l'intégralité des utilisateurs dans le navigateur, sans pagination ni recherche serveur. C'est incohérent avec Reports (pagination serveur) et avec les endpoints de vérification (limit + search côté serveur).

**Correctif suggéré :** Utiliser la pagination serveur et déléguer la recherche au backend (paramètre `search`) comme pour les autres écrans admin, plutôt que d'agréger toutes les pages côté client.

#### 🟡 Libellés d'actions d'audit codés en dur en français (non i18n)
*medium · UX/A11y · confiance high* — `src/utils/admin-action-label.ts:1`

ACTION_LABELS et les replis (« Action inconnue », « Export … », capitalisation) sont en français codé en dur et ne passent pas par i18n. En revanche les pages Reports/Users affichent directement `event.action` (Reports ligne 456, Users ligne 430), donc getAdminActionLabel n'est même pas appliqué là où l'historique d'audit est rendu : l'utilisateur voit la clé technique brute (ex. `reports.update`) au lieu d'un libellé. Double problème : texte en dur côté util, et util non utilisé côté UI.

**Correctif suggéré :** Soit appliquer getAdminActionLabel à `event.action` dans Reports.tsx et Users.tsx, soit mieux, mapper les actions via des clés i18n (`t('admin.audit.action.' + action)`) avec repli, pour respecter la règle « toute chaîne visible passe par i18n ».

#### ⚪ L'email est affiché trois fois et la colonne Contact n'apporte rien
*low · UX/A11y · confiance high* — `src/pages/Admin/CourierVerifications.tsx:200`

Dans la table coursiers, la colonne « courier » affiche le nom + l'email (lignes 201-204), puis la colonne « contact » réaffiche uniquement le même email (ligne 207). L'email apparaît donc deux fois par ligne sans autre information de contact (pas de téléphone). C'est redondant et fait perdre une colonne utile.

**Correctif suggéré :** Soit retirer l'email du bloc « courier » (ne garder que le nom), soit enrichir la colonne contact avec un téléphone si disponible, soit fusionner les deux colonnes.

#### ⚪ Couleurs hardcodées et styles inline au lieu du design system
*low · Visuel · confiance high* — `src/pages/Admin/ListingsModeration.tsx:410`

Nombreuses couleurs en dur et styles inline répétés à travers les pages admin : `#f0f4ff`, `#e5e7eb`, `#6c757d`, `#f8f9fa`, `#4b5563`, bordures inline (ex. lignes 344, 410, 443, 514, 540). Les selects natifs `<select className="input">` (lignes 279-323) réinventent un contrôle alors que le composant `Select` du design system (utilisé dans Reports.tsx) existe, d'où une incohérence visuelle et d'accessibilité entre écrans. Les badges utilisent des classes `admin-status--*` (bon) mais le reste mélange tokens et valeurs en dur.

**Correctif suggéré :** Extraire ces couleurs vers des variables SCSS/tokens et remplacer les `<select>` natifs par le composant `Select` partagé pour homogénéiser l'apparence et le clavier/aria sur toutes les pages admin.

#### ⚪ Loading/empty en texte brut au lieu des composants Skeleton/EmptyState
*low · Visuel · confiance high* — `src/pages/Admin/CompanyVerifications.tsx:191`

Les états de chargement et vides sont rendus avec un simple `<td>` texte gris (« loading », « empty ») dans toutes les pages (Listings ligne 374, Company 191/285, Courier 191/279, Reports 287, Users 284/375). Le design system fournit Skeleton, EmptyState et LoadingOverlay qui ne sont pas utilisés, ce qui donne un rendu pauvre et incohérent avec le reste de l'app.

**Correctif suggéré :** Utiliser Skeleton pour les lignes en chargement et EmptyState pour les listes vides afin d'uniformiser l'expérience et offrir une action de retry/refresh visible.

#### ⚪ ID technique brut affiché et clé d'export non fiable
*low · UX/A11y · confiance high* — `src/pages/Admin/Reports.tsx:307`

La colonne « id » affiche l'identifiant brut du signalement (`{report.id}`, souvent un UUID), ce qui élargit la colonne et n'a pas de valeur métier. Le titre d'annonce repli sur `report.listingId` (ligne 308) qui est aussi un UUID lorsque la relation listing est nulle.

**Correctif suggéré :** Afficher un ID court/tronqué ou un numéro de référence lisible, et pour le listing nul afficher un libellé i18n (ex. « Annonce supprimée ») plutôt que l'UUID brut.

#### ⚪ Lignes de la file de modération cliquables uniquement à la souris
*low · UX/A11y · confiance high* — `src/pages/Admin/ListingsModeration.tsx:405`

Le `<tr onClick>` sélectionne l'annonce pour le panneau d'aperçu, mais sans `role`, `tabIndex` ni gestion clavier : impossible de sélectionner une ligne au clavier. Les utilisateurs clavier/lecteur d'écran ne peuvent pas ouvrir l'aperçu d'une annonce. Le `cursor: pointer` suggère pourtant une interactivité.

**Correctif suggéré :** Rendre la sélection accessible au clavier (ex. un bouton « Aperçu » dédié par ligne, ou rendre la cellule titre focusable avec onKeyDown Enter/Espace) plutôt qu'un onClick sur tout le `<tr>`.

#### ⚪ Bouton « Guide » sans action
*low · Bug/Logique · confiance high* — `src/pages/Admin/ListingsModeration.tsx:266`

Le bouton `t('admin.listingsModeration.guide')` n'a aucun `onClick` ni `href` : il est cliquable mais ne fait rien, ce qui est trompeur pour l'utilisateur.

**Correctif suggéré :** Câbler le bouton (ouvrir le guide/modale/lien) ou le retirer tant qu'il n'a pas de destination.

---

### Admin — catalogue & configuration  ·  9 findings (🟡3 ⚪6)

#### 🟡 CategoryFormBuilder utilise DashboardLayout au lieu de AdminLayout
*medium · Visuel · confiance high* — `src/pages/Admin/CategoryFormBuilder.tsx:1667`

La page est rendue dans <DashboardLayout> alors que c'est une route admin (requireAdmin + featureFlag adminConsole, AppRouter l.382-389) et que toutes les autres pages de la fonctionnalité (Categories, AddCategory, Settings, Promotions, SearchRelevance) utilisent <AdminLayout>. Résultat : navigation latérale et chrome 'utilisateur' au lieu de la console admin, rupture de cohérence et de contexte de navigation pour l'admin.

**Correctif suggéré :** Importer et utiliser AdminLayout comme dans les autres pages admin pour une chrome/navigation cohérente.

#### 🟡 Modales du form builder réinventées en inline styles au lieu du composant Modal (a11y manquante)
*medium · UX/A11y · confiance high* — `src/pages/Admin/CategoryFormBuilder.tsx:1226`

renderStepModal (l.1226) et renderFieldModal (l.1464) construisent un overlay/card à la main (styles.modalOverlay / styles.fieldModalOverlay) au lieu d'utiliser src/components/ui/Modal. Conséquences a11y/UX : pas de role='dialog'/aria-modal, pas de piège de focus, pas de fermeture par Échap, pas de fermeture au clic backdrop, pas de restauration du focus à la fermeture, scroll de fond non bloqué. De plus les <label> (ex. l.1236, 1244, 1252, 1264, 1286, 1492, 1503, 1523, 1533, 1572, 1589) n'ont ni htmlFor ni id sur l'input associé, donc le clic sur le label ne focalise pas le champ et les lecteurs d'écran ne lient pas label/champ.

**Correctif suggéré :** Réutiliser le composant Modal (déjà employé dans Promotions.tsx) et FormField (qui gère htmlFor + association) pour les deux modales, ou à défaut ajouter role='dialog', aria-modal, gestion Échap/focus-trap et lier chaque label à son input via htmlFor/id.

#### 🟡 SearchRelevance entièrement en français codé en dur (aucune i18n)
*medium · UX/A11y · confiance high* — `src/pages/Admin/SearchRelevance.tsx:176`

Toute la page (titres 'Recherche avancée'/'Pertinence'/'Synonymes', sous-textes, placeholders 'Terme (ex: telephone)', boutons 'Actualiser'/'Enregistrer'/'Ajouter'/'Supprimer', en-têtes de table 'Terme/Synonyme/Statut/Action', statuts 'Actif'/'Inactif', messages d'état 'Chargement...'/'Aucun synonyme configuré.' et tous les toasts) est en français littéral sans useI18n/t(). Contrairement aux autres pages admin, cette page ne sera jamais en anglais et viole la règle 'toute chaîne visible doit passer par i18n'.

**Correctif suggéré :** Introduire useI18n() et router toutes les chaînes visibles via t() avec des clés admin.searchRelevance.* ajoutées dans translations.ts (FR + EN).

#### ⚪ Navigation par window.location.assign au lieu du routeur SPA
*low · UX/A11y · confiance high* — `src/pages/Admin/Categories.tsx:276`

Le bouton 'Ajouter' (l.276) et l'action 'Éditer' (l.362) utilisent window.location.assign(...), ce qui provoque un rechargement complet de la page (perte d'état, re-bootstrap React, re-fetch de tout l'admin) alors que react-router-dom v6 est utilisé ailleurs dans le même fichier (Link l.376) et que useNavigate est disponible. Incohérent et coûteux en perf perçue.

**Correctif suggéré :** Remplacer par useNavigate() : navigate('/admin/categories/new') et navigate(`/admin/categories/new?id=${category.id}`). Utiliser <Link> ou navigate de façon homogène.

#### ⚪ Libellés 'Prive' et 'Pro' en dur (non i18n) dans la liste des étapes
*low · UX/A11y · confiance high* — `src/pages/Admin/CategoryFormBuilder.tsx:1176`

Les badges d'audience affichent les chaînes littérales 'Prive' (l.1176) et 'Pro' (l.1177) en dur, sans passer par t(). Le reste du fichier est entièrement internationalisé, c'est donc une incohérence ; 'Prive' est en plus sans accent.

**Correctif suggéré :** Remplacer par t('admin.formBuilder.step.audiencePrivate') / t('admin.formBuilder.step.audiencePro') (ou clés équivalentes) et ajouter les entrées dans translations.ts.

#### ⚪ Chaînes en dur non internationalisées dans AddCategory
*low · UX/A11y · confiance high* — `src/pages/Admin/AddCategory.tsx:124`

Plusieurs textes visibles sont codés en dur en français au lieu de passer par t() : le message d'erreur 'Le JSON de extraFields est invalide.' (l.124), le label 'Categorie active' (l.248, sans accent), et le hint 'JSON libre: droits, ad_types, channel, etc.' (l.261). Le reste du composant utilise t() partout, donc ces libellés ne seront pas traduits en anglais et brisent la cohérence i18n.

**Correctif suggéré :** Externaliser ces trois chaînes via des clés i18n (ex. admin.addCategory.fields.extraFieldsInvalid, admin.addCategory.fields.activeLabel, admin.addCategory.fields.extraFieldsHint).

#### ⚪ Titre de groupe brut et label 'Activer' en dur dans Settings
*low · UX/A11y · confiance high* — `src/pages/Admin/Settings.tsx:343`

Le titre de section affiche la clé de groupe brute renvoyée par l'API (<h2>{group}</h2>, l.343) : si le backend renvoie un identifiant technique (ex. 'payments', 'search'), l'admin voit une chaîne non traduite/peu lisible. De plus le toggle booléen affiche '<span>Activer</span>' en dur (l.362), non internationalisé alors que tout le reste passe par t().

**Correctif suggéré :** Mapper la clé de groupe vers un libellé i18n (t(`admin.settings.groups.${group}`) avec fallback sur group), et remplacer 'Activer' par t('admin.settings.enable') (ou réutiliser une clé actions existante).

#### ⚪ Promotions : nombreuses chaînes hardcodées via loc==='fr' au lieu de t(), et window.prompt pour la référence de paiement
*low · UX/A11y · confiance high* — `src/pages/Admin/Promotions.tsx:482`

De nombreux textes visibles sont construits par des ternaires locale==='fr' ? '...' : '...' au lieu d'utiliser t() : labels de paiement (l.182-198), messages de validation (l.315-318, 327-330, 346-349, 354-357, 365-368), libellés 'Paiement campagne' (l.676), 'Marquer payé'/'Mark as paid' et 'Mise à jour paiement…' (l.731-736), toasts paiement (l.504-508, 518-521). Cela duplique la logique i18n hors de translations.ts et est fragile. Par ailleurs handlePaymentStatusUpdate (l.482) demande la référence de paiement via window.prompt() — UX brute, non stylée, sans validation UUID inline ni feedback, alors que le formulaire valide déjà les UUID par regex ailleurs (l.376).

**Correctif suggéré :** Déplacer toutes ces chaînes dans translations.ts et les appeler via t(...). Remplacer window.prompt par un petit Modal (composant ui/Modal) avec FormField + validation UUID cohérente avec validateForm.

#### ⚪ validateStep n'efface pas les erreurs résolues d'une étape (erreurs fantômes persistantes)
*low · Bug/Logique · confiance high* — `src/pages/Admin/Promotions.tsx:414`

validateStep (l.401-419) ne fusionne dans formErrors que les NOUVELLES erreurs de l'étape (setFormErrors(prev => ({ ...prev, ...scopedErrors }))) et ne supprime jamais les erreurs d'un champ de l'étape qui vient d'être corrigé. Scénario : à l'étape 0, le nom est vide → erreur affichée ; l'utilisateur saisit un nom puis re-clique 'Suivant' : scopedErrors ne contient plus 'name', mais comme on ne nettoie pas, formErrors.name reste affiché tant que l'étape passe (return true) — l'erreur ne disparaît qu'au prochain validateForm complet via handleSubmit. handleFormChange ne réinitialise pas non plus l'erreur du champ modifié.

**Correctif suggéré :** Dans validateStep, recalculer l'ensemble des erreurs de l'étape et remplacer celles des champs de l'étape (supprimer les clés du step absentes de scopedErrors), ou effacer l'erreur d'un champ dans handleFormChange dès qu'il est modifié.

---

### Admin — monitoring & finance  ·  9 findings (🟡2 ⚪7)

#### 🟡 PlatformWallet et ZikopayTransactions : tous les libellés en français codés en dur (hors i18n)
*medium · UX/A11y · confiance high* — `src/pages/Admin/PlatformWallet.tsx:177`

Contrairement aux autres écrans admin (Logs, MessageNotificationLogs, Monitoring) qui passent par useI18n/t(), PlatformWallet et ZikopayTransactions n'importent même pas useI18n. Tout est codé en dur : titres ('Wallet plateforme', 'Transactions Zikopay'), sous-titres, libellés de filtres ('Toutes', 'Versements', 'Commissions', 'Confirmés'...), états ('Chargement...', 'Aucune transaction pour le moment.'), labels de statut/type, messages de toast d'erreur. En mode EN ces écrans resteront en français. Incohérence avec la règle i18n du projet.

**Correctif suggéré :** Introduire useI18n et déplacer toutes les chaînes visibles vers src/i18n/translations.ts (clés admin.platformWallet.* et admin.zikopay.*), comme c'est déjà fait pour admin.logs.* et admin.notificationLogs.*.

#### 🟡 MessageNotificationLogs : total affiché mais aucune pagination (plafond 100, reste inaccessible)
*medium · Bug/Logique · confiance high* — `src/pages/Admin/MessageNotificationLogs.tsx:82`

loadLogs envoie toujours limit:100, offset:0 (l.82-83) et affiche le total renvoyé par l'API. Si total > 100, l'admin voit '247 résultats' mais seules les 100 premières lignes sont chargées, sans bouton 'Charger plus' ni pagination ni offset. Les logs au-delà de 100 sont définitivement inaccessibles depuis cet écran. L'API (fetchMessageNotificationLogs) supporte pourtant offset.

**Correctif suggéré :** Ajouter une pagination ou un bouton 'Charger plus' utilisant l'offset (comme PlatformWallet/Zikopay), ou au minimum indiquer que seules les 100 premières lignes sont affichées.

#### ⚪ PlatformWallet déclenche 2 requêtes transactions identiques au montage
*low · Bug/Logique · confiance high* — `src/pages/Admin/PlatformWallet.tsx:102`

Deux useEffect s'exécutent au montage : celui des lignes 102-105 appelle loadTransactions('reset') et celui des lignes 107-109 (dépendances filterType/filterStatus/dateFrom/dateTo/loadTransactions) s'exécute aussi au premier rendu et rappelle loadTransactions('reset'). Résultat : deux GET identiques sur /admin/platform-wallet/transactions au chargement de la page (gaspillage réseau, risque de clignotement de liste, et possible course si les réponses reviennent dans le désordre).

**Correctif suggéré :** Supprimer l'appel loadTransactions('reset') du premier effet (ne garder que loadSummary()), et laisser le second effet (sur les filtres) gérer le chargement initial + les rechargements. Alternativement, fusionner les deux effets.

#### ⚪ Monitoring : setState possible après démontage (auto-refresh 30s + absence de garde dans loadStatus)
*low · Bug/Logique · confiance high* — `src/pages/Admin/Monitoring.tsx:93`

loadStatus (lignes 33-59) appelle setStatus/setError sans aucune garde d'activité ; le flag `active` du premier effet (ligne 80) ne protège que setIsLoading. L'intervalle d'auto-refresh (lignes 93-98) déclenche loadStatus toutes les 30s : si la réponse arrive après le démontage du composant, on a un setState sur composant démonté (warning React, fuite). De plus fetchSearchOperationalStatus n'est jamais annulé via AbortSignal alors que utils/api.ts supporte `signal`.

**Correctif suggéré :** Passer un AbortSignal à fetchSearchOperationalStatus (apiGet supporte options.signal) et l'abort dans le cleanup, ou propager un flag d'activité jusqu'à loadStatus pour ignorer les setState après démontage. Idéalement abort la requête en cours quand l'intervalle re-déclenche.

#### ⚪ AdminHome : section 'Monitoring recherche' avec textes français en dur malgré useI18n disponible
*low · UX/A11y · confiance high* — `src/pages/Admin/AdminHome.tsx:214`

La page importe et utilise t() pour le haut de page, mais toute la section monitoring recherche est en dur : 'Monitoring recherche' (l.214), 'Rafraichir'/'Rafraichissement...' (l.221), 'Envoyer alerte'/'Envoi...' (l.228), les labels du statusChip ('INCONNU','CRITIQUE','DEGRADE','OK' l.73-84), 'Derniere mesure', 'Listings (avec recherche)', 'requetes/p95/erreurs', 'Alertes actives', 'Aucune alerte.', 'Dernier dispatch', 'Canaux', et les titres/messages de toast (l.111-141). Idem 'Chargement monitoring...' / 'Monitoring indisponible.' (l.303).

**Correctif suggéré :** Router toutes ces chaînes via t() (réutiliser les clés admin.monitoring.* déjà existantes, ex. admin.monitoring.status.* qui sont définies dans translations.ts) au lieu de chaînes littérales.

#### ⚪ MessageNotificationLogs : changer un Select de filtre ne recharge pas, oblige à cliquer 'Appliquer'
*low · UX/A11y · confiance high* — `src/pages/Admin/MessageNotificationLogs.tsx:132`

Les Select statut/canal/fournisseur (l.132-155) ne font que muter l'état filters ; le rechargement n'a lieu qu'au clic sur 'Appliquer' (l.156) ou 'Actualiser'. Sur ZikopayTransactions, à l'inverse, les filtres se rappliquent automatiquement (effet debounce l.86-91). Cette incohérence de comportement entre deux écrans admin proches est déroutante : un utilisateur qui change le filtre statut et regarde la liste sans cliquer croira que rien ne correspond.

**Correctif suggéré :** Soit déclencher loadLogs automatiquement quand un Select change (les Select sont des choix discrets, pas besoin de debounce), soit aligner Zikopay/Notiflogs sur un même modèle. Au minimum, garder le champ texte derrière 'Appliquer' mais auto-appliquer les Select.

#### ⚪ ZikopayTransactions : le filtrage debounce ignore le premier rendu et double potentiellement avec l'effet de montage
*low · Bug/Logique · confiance high* — `src/pages/Admin/ZikopayTransactions.tsx:82`

Deux effets se chevauchent : l.82-84 charge au montage (dépend de loadTransactions), et l.86-91 (debounce 300ms sur filtres + loadTransactions) s'exécute aussi au montage et planifie un second loadTransactions('reset') ~300ms après. Comme loadTransactions change d'identité à chaque modif de transactions.length (dépendance l.79), le second effet peut se re-déclencher après le premier chargement et relancer une requête reset non désirée, provoquant un re-fetch en boucle dans certains cas (chaque reset modifie transactions.length -> nouvelle identité de loadTransactions -> re-run de l'effet debounce).

**Correctif suggéré :** Retirer transactions.length des dépendances de loadTransactions (utiliser une ref pour l'offset, ou passer l'offset en argument), et ne garder qu'un seul effet de chargement piloté par les filtres. Cela supprime la dépendance instable qui ré-arme les effets.

#### ⚪ Export CSV (Wallet & Zikopay) : aucun état de chargement et téléchargement d'un fichier vide possible
*low · UX/A11y · confiance high* — `src/pages/Admin/PlatformWallet.tsx:217`

Le bouton 'Export CSV' (PlatformWallet l.217, Zikopay l.199) n'a pas d'état disabled/loading pendant le téléchargement : un double-clic lance deux téléchargements concurrents, et l'utilisateur n'a aucun retour visuel pendant l'attente (le contenu CSV peut être volumineux). De plus aucun toast de succès n'est émis, et si la réponse est vide on télécharge quand même un fichier vide sans avertissement.

**Correctif suggéré :** Ajouter un état isExporting (disabled + libellé 'Export en cours...'), émettre un toast de succès, et gérer le cas de réponse vide. Optionnellement réutiliser le hook useExportJob déjà utilisé par Logs pour homogénéiser.

#### ⚪ Styles inline et couleurs hex codées en dur au lieu du design system SCSS
*low · Visuel · confiance high* — `src/pages/Admin/ZikopayTransactions.tsx:149`

PlatformWallet et ZikopayTransactions reconstruisent à la main badges de statut, listes et espacements via style inline et couleurs hex codées (#64748b, #94a3b8, rgba(15,23,42,0.08), statusStyle() l.149-155 dans Zikopay, statusChip l.73-84 dans AdminHome). Les classes existantes 'admin-status admin-status--approved/rejected/pending' (utilisées dans MessageNotificationLogs) et 'admin-table'/'admin-card' ne sont pas réutilisées ici, ce qui produit une incohérence visuelle entre écrans admin et duplique la logique de couleur de statut.

**Correctif suggéré :** Réutiliser les classes SCSS admin-status--* / admin-table / admin-card existantes pour les badges de statut et les listes, et déplacer les couleurs/espacements vers le SCSS plutôt que des styles inline.

---

### Dashboard — achats/commandes/livraisons/alertes  ·  9 findings (🟡4 ⚪5)

#### 🟡 Orders.tsx : tous les libellés en dur, aucun i18n
*medium · UX/A11y · confiance high* — `src/pages/Dashboard/Orders.tsx:7`

Contrairement à Favorites.tsx et Alerts.tsx qui passent tout par t(), Orders.tsx code en dur l'intégralité des chaînes visibles : titre 'Commandes', sous-titre, les 9 STATUS_LABELS (lignes 7-17), 'Mode:', 'Livraison'/'Remise en main propre' (l.68), 'Total:' (l.70), 'Annonce' (l.66), 'Chargement...' (l.59), 'Aucune commande pour le moment.' (l.87) et le titre du toast d'erreur. Aucune clé 'orders.*' n'existe dans src/i18n/translations.ts (vérifié). La page est donc figée en français et l'app EN affichera du français.

**Correctif suggéré :** Ajouter un bloc de clés orders.* (orders.title, orders.subtitle, orders.status.<status>, orders.mode.delivery/pickup, orders.total, orders.empty, orders.loading, orders.loadError) dans les deux locales de translations.ts et remplacer toutes les littérales par t(). Réutiliser useI18n() comme dans Alerts.tsx.

#### 🟡 Orders.tsx : erreur de chargement signalée seulement par toast, pas d'état d'erreur persistant ni retry
*medium · API/Data · confiance high* — `src/pages/Dashboard/Orders.tsx:32`

En cas d'échec de GET /orders/mine, on émet un toast puis loading passe à false et la vue affiche 'Aucune commande pour le moment.' — message faux qui laisse croire que l'utilisateur n'a aucune commande alors que le réseau a échoué. Aucun état error persistant ni bouton réessayer, contrairement à Favorites/Alerts/FollowedSellers qui exposent un état error.

**Correctif suggéré :** Introduire un state error et, comme dans FollowedSellers.tsx, distinguer trois cas (loading / error+retry / empty). Idéalement utiliser RetryBanner (src/components/ui/RetryBanner) pour offrir un re-fetch.

#### 🟡 Deliveries.tsx : les actions (accept, status, pickup/delivery confirm, release, getPickupCode) n'ont aucun try/catch
*medium · API/Data · confiance high* — `src/pages/Dashboard/Deliveries.tsx:61`

handleAccept (l.61), handleStatusUpdate (l.66), handleGetPickupCode (l.71), handleConfirmPickup (l.76), handleConfirmDelivery (l.92) et handleRelease (l.99) appellent apiPost/apiPatch/apiGet sans try/catch. apiRequest rejette (throw new Error) sur toute réponse non-ok : la promesse d'un onClick async est non gérée → échec totalement silencieux pour l'utilisateur (ex. mauvais code de remise saisi dans le prompt, course déjà prise). Seul refresh() a un catch ; les mutations n'en ont pas.

**Correctif suggéré :** Envelopper chaque handler dans try/catch et émettre un addToast variant:'error' avec le message d'erreur (err instanceof Error ? err.message). Sur succès des confirmations de code, afficher aussi un toast de confirmation. Modèle déjà présent dans Alerts.tsx (handleDelete/handleToggle).

#### 🟡 Deliveries.tsx : saisie des codes via window.prompt (non accessible, non i18n, non stylé)
*medium · UX/A11y · confiance high* — `src/pages/Dashboard/Deliveries.tsx:77`

Les codes de remise (l.77) et de réception (l.93) sont saisis via window.prompt avec des libellés en dur en français. Cela contourne le design system (Modal/Input existent dans src/components/ui), n'est pas accessible (focus/clavier/ARIA non maîtrisés), n'est pas internationalisé et est bloquant. window.prompt peut aussi être désactivé par certains navigateurs.

**Correctif suggéré :** Remplacer par un Modal (src/components/ui/Modal) contenant un Input contrôlé et un bouton de validation, avec libellés via t(). Réutiliser le pattern de la modale d'édition d'Alerts.tsx.

#### ⚪ Deliveries.tsx : styles inline et couleurs hex en dur au lieu du SCSS / design system
*low · Visuel · confiance high* — `src/pages/Dashboard/Deliveries.tsx:122`

La page utilise massivement des style={{}} inline avec des couleurs codées en dur (#6b7280, #0f172a, #f8fafc, rgba(148,163,184,0.3)) et des dimensions hardcodées (padding 16px, gap 16px) — lignes 122, 142, 150-253. Les autres pages du dashboard (Alerts, Favorites, FollowedSellers) reposent sur des classes SCSS (dashboard-page, dashboard-table, lbc-storefront-card, card). Cela casse la cohérence visuelle et le theming (mode sombre ignoré car couleurs en dur).

**Correctif suggéré :** Extraire ces styles vers des classes SCSS dédiées (ex. deliveries-card, deliveries-card__meta) dans src/assets/scss et utiliser les tokens de couleur du thème, comme le reste du dashboard.

#### ⚪ Deliveries.tsx : statut et escrowStatus affichés bruts, sans libellé i18n
*low · UX/A11y · confiance high* — `src/pages/Dashboard/Deliveries.tsx:174`

delivery.status est rendu brut (l.174 : 'requested'/'accepted'/'picked_up'...) et escrowStatus aussi (l.182 : 'held'/'released'...). L'utilisateur voit des identifiants techniques anglais. Tous les autres écrans (Orders STATUS_LABELS, Alerts status) mappent les statuts vers des libellés lisibles. De plus tout le texte ('Acheteur:', 'Vendeur:', 'Distance:', 'Escrow:', 'Accepter la course', 'Confirmer la réception', 'Paiement sécurisé en attente', 'Adresse de départ non définie', 'Aucune livraison pour le moment.') est en dur, non i18n.

**Correctif suggéré :** Créer une map de libellés statut/escrow via t() (clés deliveries.status.*, deliveries.escrow.*) et passer toutes les chaînes visibles par useI18n(), à l'image d'Alerts.tsx.

#### ⚪ Alerts.tsx : pendant une suppression en cours, les boutons Modifier/Activer de la même ligne restent actifs
*low · Bug/Logique · confiance high* — `src/pages/Dashboard/Alerts.tsx:330`

Sur une ligne, le bouton Modifier est disabled si isSaving || updatingId===alert.id (l.333) et le toggle si updatingId===alert.id (l.341), mais aucun n'est désactivé pendant deletingId===alert.id. On peut donc cliquer Modifier ou Activer/Désactiver sur une alerte en train d'être supprimée, déclenchant une PATCH sur une ressource qui va disparaître (course/erreur 404 selon l'ordre des réponses).

**Correctif suggéré :** Ajouter deletingId === alert.id (et idéalement un flag global de mutation) aux conditions disabled des boutons Modifier et toggle de la ligne.

#### ⚪ Favorites.tsx : code de suivi vendeur mort (import Link + handleFollowSeller jamais utilisés)
*low · Bug/Logique · confiance high* — `src/pages/Dashboard/Favorites.tsx:2`

Link est importé (l.2) mais jamais rendu. isFollowing/followSeller/unfollowSeller sont déstructurés (l.27) et handleFollowSeller défini (l.102-112) mais jamais appelés dans le JSX — la fonctionnalité de suivi vendeur a manifestement été retirée sans nettoyer. Cela charge inutilement le hook useFollowedSellers (qui déclenche un GET /users/me/follows au montage) à chaque ouverture des favoris, sans usage.

**Correctif suggéré :** Supprimer l'import Link, le hook useFollowedSellers et handleFollowSeller s'ils ne sont pas réintégrés, ou rebrancher le bouton de suivi vendeur sur les cartes.

#### ⚪ FollowedSellers.tsx : setFollowed appelé après unfollow mais le hook n'est pas la source de vérité de la liste
*low · Bug/Logique · confiance high* — `src/pages/Dashboard/FollowedSellers.tsx:117`

Le handler 'Ne plus suivre' appelle unfollowSeller(id) (qui fait DELETE), puis setFollowed(id,false) et setItems(filter). unfollowSeller n'a pas de try/catch : si le DELETE échoue, la promesse rejette, setFollowed/setItems ne s'exécutent pas (la ligne reste, comportement acceptable) mais aucune erreur n'est remontée à l'utilisateur (pas de toast). De plus useToast n'est même pas importé ici, donc aucune voie de feedback d'erreur sur cette page.

**Correctif suggéré :** Envelopper l'action dans try/catch et afficher un toast d'erreur (importer useToast). Confirmer le retrait optimiste seulement après succès.

---

### Accueil  ·  8 findings (🟡3 ⚪5)

#### 🟡 coverImage des annonces non passé par resolveMediaUrl (incohérent avec les storefronts)
*medium · API/Data · confiance high* — `src/pages/Home/Home.tsx:1082`

Les images de boutiques utilisent resolveMediaUrl (lignes 967, 981) pour préfixer les chemins relatifs avec API_BASE_URL, mais les coverImage des cartes d'annonces sont injectées brutes: style={hasCover ? { backgroundImage: `url(${listing.coverImage})` } : undefined} (lignes 1082 et 1210). Si le backend renvoie un chemin relatif (ex: /uploads/xxx.jpg) pour coverImage, comme c'est le cas pour heroUrl/avatarUrl des boutiques, les vignettes d'annonces seront résolues contre l'origine du frontend et casseront, alors que les images de boutiques fonctionneront. Incohérence interne sur la même page.

**Correctif suggéré :** Appliquer resolveMediaUrl(listing.coverImage) dans les deux blocs (featured ligne 1082 et nearby ligne 1210), comme pour les storefronts, afin de gérer uniformément les chemins relatifs.

#### 🟡 Labels du formulaire de recherche non associés à leurs inputs
*medium · UX/A11y · confiance high* — `src/pages/Home/Home.tsx:760`

Les <label> du formulaire de recherche (lignes 760 'queryLabel' et 806 'locationLabel') n'ont ni htmlFor ni input imbriqué: l'input est un sibling. Il n'y a donc aucune association programmatique label/champ. Les lecteurs d'écran n'annonceront pas le libellé du champ, et cliquer le label ne focalise pas l'input. Accessibilité dégradée sur le composant le plus utilisé de la page.

**Correctif suggéré :** Associer chaque label à son input via htmlFor/id (ou imbriquer l'input dans le label). Ajouter aussi aria-label sur les inputs si le label visuel reste séparé.

#### 🟡 Combobox de suggestions: rôles ARIA incomplets (listbox sans option, pas d'aria-expanded/activedescendant)
*medium · UX/A11y · confiance high* — `src/pages/Home/Home.tsx:781`

Le panneau de suggestions porte role="listbox" (ligne 781) mais ses enfants sont des <button> sans role="option" ni aria-selected (lignes 786-797). L'input de recherche n'expose ni role="combobox", ni aria-expanded, ni aria-controls, ni aria-activedescendant. La navigation clavier dans la liste (flèches haut/bas) n'est pas implémentée: seul Escape ferme (ligne 308). Le pattern combobox est donc inaccessible au clavier et aux lecteurs d'écran.

**Correctif suggéré :** Implémenter le pattern WAI-ARIA combobox: role="combobox" + aria-expanded/aria-controls/aria-activedescendant sur l'input, role="option"/aria-selected sur chaque suggestion, et gestion des touches ArrowUp/ArrowDown/Enter pour parcourir et valider.

#### ⚪ Logique follow/unfollow déclarée mais jamais câblée dans le rendu
*low · Bug/Logique · confiance high* — `src/pages/Home/Home.tsx:157`

Le hook useFollowedSellers est consommé (isFollowing, followSeller, unfollowSeller) et la fonction handleFollowSeller est définie (lignes 180-190), mais aucun de ces symboles n'est utilisé dans le JSX. isFollowing et handleFollowSeller ne sont référencés nulle part dans le rendu. C'est du code mort qui déclenche un appel réseau inutile vers /users/me/follows à chaque montage de la Home (via le useEffect interne du hook) pour un utilisateur authentifié, sans qu'aucun bouton de suivi ne soit affiché. Selon la config TS/ESLint (noUnusedLocals) cela peut aussi casser le build strict.

**Correctif suggéré :** Soit câbler un bouton de suivi vendeur sur les cartes (storefronts ou listing-card via handleFollowSeller/isFollowing(listing.owner?.id)), soit supprimer l'import useFollowedSellers, handleFollowSeller et les destructurations associées pour éviter l'appel réseau et le code mort.

#### ⚪ États d'erreur réseau réduits à un toast, sans distinction erreur/vide ni retry
*low · API/Data · confiance high* — `src/pages/Home/Home.tsx:193`

Pour la majorité des sections (hero, categories, services, listings, testimonials, trending, sellerSplit), l'état d'erreur est volontairement ignoré dans le rendu: les setters sont déstructurés en [, setХError] (lignes 193, 196, 199, 202, 207-208, 211, 214) donc la valeur d'erreur n'est jamais lue. En cas d'échec réseau, la section retombe sur son empty-state (ex: 'Aucune tendance pour le moment.') qui ment à l'utilisateur (vide vs erreur), et n'offre aucun retry. Seuls les storefronts gèrent une vraie variable d'erreur. Or RetryBanner est le pattern utilisé ailleurs dans l'app (Storefront, PublicProfile, DashboardOverview, Messages...).

**Correctif suggéré :** Conserver et lire les valeurs d'erreur, puis afficher un RetryBanner (composant existant src/components/ui) avec une action de relance par section au lieu d'afficher l'empty-state, au minimum pour les sections critiques (listings, categories). Cela aligne aussi la Home sur le design system de gestion d'erreur du reste de l'app.

#### ⚪ Clé React non fiable: service.title comme key
*low · Bug/Logique · confiance high* — `src/pages/Home/Home.tsx:1303`

Dans la section services, la liste utilise key={service.title} (ligne 1303). Le type HomeService (src/types/home.ts ligne 69) n'a pas d'identifiant et title n'est pas garanti unique côté backend. Deux services au même titre provoqueraient des collisions de clés et des bugs de réconciliation. Idem pour les heroTags qui utilisent key={tag} (ligne 827): des tags dupliqués casseraient les clés.

**Correctif suggéré :** Ajouter un id stable dans HomeService côté API/type et l'utiliser comme key, ou à défaut combiner title+index (`${service.title}-${index}`). Pour heroTags, dédupliquer la liste ou utiliser `${tag}-${index}`.

#### ⚪ Filtrage client peut vider une section et afficher un faux empty-state
*low · UX/A11y · confiance high* — `src/pages/Home/Home.tsx:1073`

featuredListings/latestListings sont re-filtrés côté client par priceBand et sellerType (filterListingsByPreferences, lignes 590-608). Si les filtres sélectionnés excluent toutes les annonces alors que featuredBase/latestBase contiennent des données, le rendu affiche l'empty-state générique 'home.featured.empty' / 'home.latest.empty' (lignes 1126, 1243) qui suggère qu'il n'y a aucune annonce, alors que c'est le filtre qui ne matche rien. De plus le filtre sellerType est déjà envoyé à l'API (ligne 449) puis re-appliqué en client, double filtrage potentiellement redondant.

**Correctif suggéré :** Distinguer 'aucune donnée' de 'aucun résultat pour ces filtres' avec un message dédié proposant de réinitialiser les filtres, et clarifier si le filtrage sellerType doit rester côté serveur uniquement pour éviter la double application.

#### ⚪ Émojis décoratifs codés en dur dans des badges/contenus (verified, rating, icône catégorie)
*low · Visuel · confiance high* — `src/pages/Home/Home.tsx:973`

Plusieurs glyphes sont codés en dur dans le markup: '✅' (ligne 973, badge boutique vérifiée), '⭐' (ligne 997, note), et l'icône de catégorie par défaut '🛒' (ligne 909). Ces émojis ne sont pas marqués aria-hidden et seront vocalisés par les lecteurs d'écran ('coche blanche', 'étoile') au milieu d'un texte i18n, et leur rendu varie selon l'OS, ce qui est incohérent avec le design system SCSS (pas d'iconographie maison). Le badge 'companyVerified' des listing-cards (lignes 1086-1088) lui n'utilise pas d'émoji, d'où l'incohérence.

**Correctif suggéré :** Remplacer ces émojis par des icônes/spans stylés via SCSS (classe d'icône) marqués aria-hidden="true", ou au minimum les envelopper dans un <span aria-hidden="true">. Centraliser le fallback d'icône de catégorie dans le design system.

---

### Création / édition d'annonce  ·  8 findings (🟡3 ⚪5)

#### 🟡 window.confirm avec texte français en dur après publication
*medium · UX/A11y · confiance high* — `src/pages/Listings/NewListing.tsx:1576`

Après création réussie, le flux propose de booster l'annonce via window.confirm('Votre annonce est publiée. Voulez-vous la booster maintenant ?'). Le texte est codé en dur (aucune des autres chaînes ne passe par t()), donc non traduit en anglais, et window.confirm est une boîte de dialogue native non stylée, non accessible au design system (contrairement au composant Modal utilisé ailleurs, ex. EditListing pour la suppression). C'est une rupture UX/i18n sur un moment clé du parcours.

**Correctif suggéré :** Remplacer le window.confirm par le composant Modal de src/components/ui avec deux actions (Booster / Plus tard), et déplacer toutes les chaînes dans i18n (ex. t('listings.new.boostPrompt.title') / message / actions).

#### 🟡 Bouton Suivant (édition) valide TOUS les champs au lieu de l'étape courante
*medium · Bug/Logique · confiance high* — `src/pages/Listings/EditListing.tsx:773`

handleNextStep appelle trigger() sans liste de champs, ce qui déclenche la validation de l'intégralité du formulaire (toutes les étapes). Si une étape ultérieure non encore visitée contient un champ obligatoire vide, isValid est false et l'utilisateur reste bloqué sur l'étape courante sans pouvoir avancer, alors que ses champs visibles sont valides. NewListing valide correctement uniquement les champs de l'étape (getStepValidationFields), ce qui rend ce comportement incohérent entre création et édition.

**Correctif suggéré :** Limiter la validation aux champs de l'étape courante: calculer les paths visibles/obligatoires de currentStep (comme getStepValidationFields dans NewListing) et appeler trigger(stepFieldPaths, { shouldFocus: true }).

#### 🟡 Images en cours d'upload silencieusement ignorées à la soumission
*medium · UX/A11y · confiance high* — `src/pages/Listings/NewListing.tsx:1554`

À la soumission, seules les images au statut 'uploaded' avec url sont envoyées (images.filter(image => image.status === 'uploaded' && image.url)). Si l'utilisateur clique sur Publier/Enregistrer pendant qu'un upload est encore 'uploading' ou en 'error', ces images sont silencieusement écartées du payload sans aucun avertissement. L'utilisateur croit avoir publié avec ses photos. Même problème dans EditListing.tsx:1284.

**Correctif suggéré :** Avant l'envoi, détecter s'il reste des images en statut 'uploading'/'error' et soit désactiver le bouton de soumission, soit afficher un toast/confirmation (ex. t('listings.images.uploadInProgress')) demandant d'attendre la fin des uploads.

#### ⚪ console.log de payloads/données laissés en production
*low · Bug/Logique · confiance high* — `src/pages/Listings/NewListing.tsx:1564`

Plusieurs console.log de débogage exposent les payloads et données utilisateur: NewListing.tsx:1564 (console.log(payload)), EditListing.tsx:922 (console.log(data)) et 1294 (console.log(payload)), useListingFormSchema.ts:93 (console.log(payload)). Ils polluent la console, peuvent fuiter des données (téléphone, email, adresse exacte) et indiquent du code non nettoyé.

**Correctif suggéré :** Supprimer ces console.log, ou les remplacer par un logger conditionné à import.meta.env.DEV.

#### ⚪ URL.createObjectURL jamais révoquée (fuite mémoire)
*low · Bug/Logique · confiance high* — `src/components/listings/ImagesManager.tsx:133`

processFileUpload crée un previewUrl via URL.createObjectURL(file) à chaque upload, mais ce blob n'est jamais révoqué par URL.revokeObjectURL — ni après remplacement par l'URL serveur (uploadFile écrase next[idx].url avec resolveMediaUrl(result.url) ligne 186), ni lors d'un removeImage, ni au démontage. Chaque image téléversée fuit un object URL en mémoire, et c'est amplifié si l'utilisateur ajoute/retire plusieurs images.

**Correctif suggéré :** Conserver le previewUrl (ex. dans l'item) et appeler URL.revokeObjectURL au moment où l'URL serveur le remplace, dans removeImage, et dans un useEffect de cleanup au démontage du composant.

#### ⚪ onSubmit (édition) avec dépendances useCallback incomplètes (closure périmée)
*low · Bug/Logique · confiance medium* — `src/pages/Listings/EditListing.tsx:1320`

Le tableau de dépendances du useCallback onSubmit n'inclut pas selectedRootCategoryId ni listingFlow, alors que ces deux valeurs sont lues dans le corps (categoryId du payload = selectedRootCategoryId || values.categoryId ligne 1264, et resolvedFlow dérive de listingFlow ligne 1226). Résultat: au premier rendu, selectedRootCategoryId est '' et listingFlow null; si l'utilisateur soumet, la closure peut capturer des valeurs périmées et envoyer un categoryId/adType incorrect au backend. setError et setValue/t sont aussi partiellement absents.

**Correctif suggéré :** Ajouter selectedRootCategoryId, listingFlow (et setError) au tableau de dépendances du useCallback, ou lire ces valeurs via getValues/ref pour éviter la capture périmée.

#### ⚪ Libellé de switch dynamique avec fallback 'Oui' en dur
*low · UX/A11y · confiance high* — `src/components/forms/DynamicFormField.tsx:462`

Pour les champs de type switch/checkbox, le libellé interne utilise field.description ?? 'Oui'. La chaîne de repli 'Oui' est codée en dur en français et ne passe pas par i18n; en l'absence de description fournie par le schéma, un utilisateur en anglais verra 'Oui'.

**Correctif suggéré :** Remplacer le fallback par une clé i18n, ex. field.description ?? t('forms.switch.defaultLabel').

#### ⚪ Grille de catégories sans état de chargement ni état vide dédié (édition)
*low · UX/A11y · confiance high* — `src/pages/Listings/EditListing.tsx:1374`

renderCategorySelection mappe directement rootCategories sans rien afficher quand categoriesLoading est true (la grille est simplement vide), et sans EmptyState si rootCategories est vide après chargement (ex. erreur réseau partielle). L'utilisateur voit une zone vide sans feedback. NewListing affiche au moins un libellé de chargement inline dans l'en-tête mais la grille reste également vide.

**Correctif suggéré :** Afficher un Skeleton/loading pendant categoriesLoading et un EmptyState (src/components/ui/EmptyState) lorsque la liste est vide après chargement, avec éventuellement un RetryBanner en cas de categoriesError.

---

### Pages statiques & erreurs  ·  8 findings (🟡2 ⚪6)

#### 🟡 Le formulaire de contact n'a aucun handler onSubmit : il recharge la page et perd les données
*medium · Bug/Logique · confiance high* — `src/pages/Static/Contact.tsx:27`

Le <form className="contact-form"> contient un <Button type="submit"> mais aucun onSubmit n'est défini. À la soumission, le navigateur effectue une navigation GET par défaut vers la même URL : la page se recharge entièrement, les champs saisis sont perdus et aucune donnée n'est jamais envoyée. Il n'y a aucun appel à utils/api.ts, aucun état de chargement, aucun message de succès/erreur. La page de contact est donc non fonctionnelle : l'utilisateur croit avoir envoyé son message alors que rien ne part.

**Correctif suggéré :** Soit ajouter un onSubmit avec e.preventDefault() qui appelle un endpoint (ex. POST /support/contact via utils/api.ts) avec gestion loading/succès/erreur (réutiliser FormField error, Button disabled, et un message de confirmation), soit, si aucun backend n'existe encore, remplacer le formulaire par un lien mailto direct vers support pour ne pas laisser un parcours mort. Câbler react-hook-form + zod comme dans les autres formulaires du projet.

#### 🟡 Champs marqués requis visuellement mais sans validation ni attribut required/aria-required
*medium · UX/A11y · confiance high* — `src/pages/Static/Contact.tsx:29`

FormField affiche un astérisque pour required (props required sur Nom/E-mail/Message), mais l'astérisque est purement décoratif : FormField ne propage pas required aux enfants et les <Input>/<textarea> ne portent ni l'attribut HTML required ni aria-required. Couplé à l'absence d'onSubmit (voir contact-form-no-submit-handler), il n'y a aucune validation : un message vide ou un e-mail invalide ne déclenche aucun feedback. L'astérisque promet une contrainte qui n'existe pas, ce qui est trompeur et inaccessible (lecteurs d'écran n'annoncent pas le caractère obligatoire).

**Correctif suggéré :** Ajouter required (ou aria-required="true") sur les Input/textarea obligatoires, et implémenter une validation (zod) affichant les erreurs via la prop error de FormField. Au minimum, brancher l'état d'erreur pour que les champs requis remontent un message.

#### ⚪ La page Error500 n'est branchée à aucun flux d'erreur réel (ErrorBoundary affiche EmptyState à la place)
*low · Bug/Logique · confiance high* — `src/router/AppRouter.tsx:439`

Error500 n'est exposée que via la route statique /500, atteignable uniquement par saisie manuelle de l'URL. Les vraies erreurs runtime sont captées par src/components/error/ErrorBoundary.tsx (utilisé dans MainLayout/DashboardLayout/AdminLayout) qui rend un EmptyState générique, pas la page Error500 soigneusement conçue. De même, aucun appel API en échec ne redirige vers /500. Résultat : la page 500 traduite et stylée est du code mort en pratique, et l'UX d'erreur serveur réelle diverge de la page prévue (incohérence de design et de messages).

**Correctif suggéré :** Soit utiliser <Error500 /> comme fallback de l'ErrorBoundary (props fallback) pour unifier l'expérience, soit assumer que /500 est volontaire et documenter/rediriger les vraies erreurs vers /500. Aligner le contenu de l'ErrorBoundary (EmptyState) avec celui d'Error500 (mêmes CTA Accueil/Contact).

#### ⚪ La FAQ se présente comme un accordéon mais affiche toutes les réponses ouvertes, sans interaction clavier
*low · UX/A11y · confiance high* — `src/pages/Static/Faq.tsx:29`

Le conteneur porte les classes faq-accordion / faq-item suggérant un accordéon, mais le rendu est une simple liste de <h3>question</h3><p>réponse</p> toujours dépliée. Aucun bouton, aucun aria-expanded, aucun toggle clavier : ce n'est pas un accordéon. Sur une vraie FAQ longue, l'absence de repli nuit à la lisibilité, et le nommage induit en erreur les futurs développeurs.

**Correctif suggéré :** Soit implémenter un vrai accordéon avec <button aria-expanded> contrôlant la visibilité de la réponse (ou <details>/<summary> natif, accessible clavier par défaut), soit renommer les classes en faq-list/faq-entry pour refléter le rendu statique réel.

#### ⚪ E-mail et téléphone du support affichés en texte brut, non cliquables
*low · UX/A11y · confiance high* — `src/pages/Static/Contact.tsx:20`

support@LEMAKET.com et +221 33 123 45 67 sont rendus dans de simples <p>. Sur mobile surtout, l'utilisateur attend des liens mailto: et tel: cliquables. Ici il doit copier manuellement. Aucune action directe possible depuis la principale carte de contact.

**Correctif suggéré :** Rendre l'e-mail via <a href="mailto:..."> et le téléphone via <a href="tel:+221331234567">. Les valeurs venant de l'i18n, construire le href à partir de la clé ou ajouter des clés dédiées au format brut (sans formatage d'affichage).

#### ⚪ Saut de niveau de titre (h1 -> h3) sur FAQ, Confidentialité et CGU
*low · UX/A11y · confiance high* — `src/pages/Static/Faq.tsx:32`

Le hero rend un <h1>, puis les items de FAQ (Faq.tsx l.32), de politique (PrivacyPolicy.tsx l.24) et de CGU (Terms.tsx l.36) passent directement à <h3>, sans <h2> intermédiaire. À l'inverse, About utilise correctement <h2> pour ses sections. Ce saut de niveau casse la hiérarchie sémantique attendue par les lecteurs d'écran et nuit au SEO de ces pages indexables.

**Correctif suggéré :** Soit utiliser <h2> pour les titres d'items dans Faq/PrivacyPolicy/Terms, soit ajouter un <h2> de section englobant avant la liste si l'on veut conserver des <h3>. Uniformiser avec About qui sert de référence.

#### ⚪ Aucune page statique ne définit le titre du document (SEO/onglet)
*low · UX/A11y · confiance high* — `src/pages/Static/About.tsx:18`

Aucune des pages statiques/erreurs (About, Contact, Faq, Privacy, Terms, 404, 500, Maintenance) ne met à jour document.title (grep confirme : aucune utilisation de document.title/Helmet dans tout src/). Ce sont pourtant des pages publiques indexables et partageables : l'onglet et le titre de partage restent génériques pour toutes les routes, ce qui dégrade le SEO et l'orientation utilisateur (notamment 404/500).

**Correctif suggéré :** Ajouter un petit hook useDocumentTitle(t('static.about.hero.title')) (ou react-helmet-async) appelé dans chaque page statique, en réutilisant les clés i18n de titre déjà présentes.

#### ⚪ Pages d'erreur : alignement à gauche du contenu mais réutilisation des classes auth-form__actions
*low · Visuel · confiance high* — `src/pages/Static/Error404.tsx:14`

Error404 et Error500 réutilisent la classe auth-form__actions (issue du module d'authentification) pour leurs CTA, ce qui crée un couplage fragile : un changement du style d'auth modifiera l'apparence des pages d'erreur sans rapport. Par ailleurs .error-page force align-items:flex-start / text-align:left, ce qui rend ces pages d'erreur visuellement moins centrées/impactantes que la page Maintenance (centrée via maintenance-actions). Incohérence visuelle entre deux écrans de même nature.

**Correctif suggéré :** Créer des classes dédiées (ex. error-page__actions) plutôt que d'emprunter auth-form__actions, et harmoniser l'alignement entre les pages d'erreur et la page de maintenance (centrer ou aligner de façon cohérente).

---

### Dashboard — vente (annonces, promos, pro)  ·  7 findings (🟡2 ⚪5)

#### 🟡 Le deep-link de promotion (?listingId=) n'est jamais lu par Promotions
*medium · Bug/Logique · confiance high* — `src/pages/Dashboard/Promotions.tsx:274`

Dans MyListings, les boutons "Promouvoir" (lignes 743 et 960) naviguent vers `/dashboard/promotions?listingId=${listing.id}`. Or PromotionsPage ne lit jamais ce paramètre de query (aucun useSearchParams ni location.search). L'annonce que l'utilisateur voulait promouvoir n'est donc pas présélectionnée : le modal de checkout retombe sur `listings[0]` ou la sélection mise en cache. Le parcours "promouvoir CETTE annonce" est cassé silencieusement, ce qui peut amener l'utilisateur à promouvoir/payer pour la mauvaise annonce.

**Correctif suggéré :** Lire `const [searchParams] = useSearchParams()` et, au montage, si `searchParams.get('listingId')` est présent, l'injecter via persistSelection({ listingId }) et/ou ouvrir directement le modal sur cette annonce après chargement de loadCheckoutData. Vérifier que l'id appartient bien aux listings de l'utilisateur avant de l'utiliser.

#### 🟡 Champs d'édition inline sans label associé (titre et prix)
*medium · UX/A11y · confiance high* — `src/pages/Dashboard/MyListings.tsx:841`

L'input d'édition du titre (841) n'a ni label ni aria-label ; pour un lecteur d'écran c'est un champ texte anonyme dans une cellule de tableau. Les inputs de prix (892, 905) utilisent un <label> qui enveloppe un <span> texte mais le champ n'a pas non plus d'aria-label explicite distinct par annonce, rendant la navigation clavier/AT ambiguë quand plusieurs lignes sont présentes.

**Correctif suggéré :** Ajouter un aria-label i18n contextualisé par annonce, ex. aria-label={t('dashboard.listings.editTitleAria', { title: listing.title })} sur l'input titre et un équivalent pour le prix.

#### ⚪ Libellé "Voir" en dur alors que la clé i18n existe
*low · UX/A11y · confiance high* — `src/pages/Dashboard/MyListings.tsx:944`

Le lien d'aperçu de l'annonce affiche `<span>Voir</span>` en dur. La clé de traduction existe pourtant déjà (`dashboard.listings.action.view` = 'Voir' / 'View', translations.ts lignes 930 et 3325). En locale EN le bouton restera affiché "Voir", incohérent avec le reste de la table qui passe bien par t().

**Correctif suggéré :** Remplacer `<span>Voir</span>` par `<span>{t('dashboard.listings.action.view')}</span>`.

#### ⚪ Préfixe "Copie de" du titre dupliqué codé en dur en français
*low · UX/A11y · confiance high* — `src/pages/Dashboard/MyListings.tsx:532`

Lors de la duplication d'une annonce, le titre est construit avec `\`Copie de ${details.title}\`` en français en dur. Un utilisateur en anglais obtiendra un brouillon intitulé "Copie de ...". Texte visible non internationalisé.

**Correctif suggéré :** Utiliser une clé i18n paramétrée, ex. t('dashboard.listings.duplicate.titlePrefix', { title: details.title }) puis .slice(0, 255).

#### ⚪ La planification accepte une date passée sans avertissement
*low · Bug/Logique · confiance high* — `src/pages/Dashboard/MyListings.tsx:595`

handleScheduleListing valide uniquement que la date est parsable (Number.isNaN), mais accepte une date dans le passé. Planifier une annonce dans le passé n'a pas de sens fonctionnel et sera silencieusement enregistré comme scheduledAt révolu. L'input datetime-local (1007) n'a pas non plus d'attribut min.

**Correctif suggéré :** Comparer `date.getTime() < Date.now()` et afficher un toast d'erreur (clé i18n dédiée) ou ajouter `min={toDateTimeLocalValue(new Date().toISOString())}` sur l'input pour empêcher la sélection passée.

#### ⚪ ActionChipButton réinvente un bouton avec styles inline/gradients codés en dur
*low · Visuel · confiance high* — `src/pages/Dashboard/MyListings.tsx:41`

ACTION_CHIP_STYLES et actionChipBaseStyle (lignes 41-113) définissent des dégradés, ombres, rayons et couleurs (#10b981, #f97316, rgba(...)) entièrement en dur via style inline, dupliquant le rôle du composant partagé Button (src/components/ui/Button) et contournant le design system SCSS. Idem pour les nombreux `color: '#6c757d'`, `#0d6efd` répétés (ex. lignes 595, 604, 615 dans Promotions). Incohérence visuelle et thème non respecté (pas de dark mode/tokens).

**Correctif suggéré :** Remplacer ActionChipButton par Button (variants existants primary/accent/outline/danger/ghost) ou créer une classe SCSS dédiée (.action-chip--renew, etc.) dans assets/scss au lieu des objets style inline ; remplacer les couleurs hardcodées par les variables/tokens du thème.

#### ⚪ Édition inline débouncée sans aucun retour de chargement/succès
*low · UX/A11y · confiance high* — `src/pages/Dashboard/MyListings.tsx:411`

queueUpdate déclenche un apiPatch après 600ms de debounce mais n'affiche aucun indicateur d'enregistrement en cours ni de confirmation de succès (seul l'échec produit un toast et un rollback). L'utilisateur ne sait pas si sa modification de titre/prix a été persistée. Sur connexion lente cameroun, l'absence totale de feedback de succès est problématique.

**Correctif suggéré :** Ajouter un état visuel par champ (ex. spinner discret ou pastille "enregistré") quand pendingUpdatesRef contient l'id, et un toast succès léger après le apiPatch réussi.

---

### Recherche & filtres  ·  7 findings (🟡1 ⚪6)

#### 🟡 Bouton 'Créer une alerte' inerte dans l'état vide
*medium · Bug/Logique · confiance high* — `src/pages/Search/components/SearchResultsList.tsx:124`

Dans l'état vide des résultats, le bouton <Button variant="outline">{t('search.alert.create')}</Button> n'a aucun onClick. Il est visuellement identique au bouton 'Créer une alerte' fonctionnel du header (qui appelle onCreateAlert), mais ici il ne fait strictement rien : pas de handler passé en prop, aucune navigation, aucune création d'alerte. L'utilisateur qui ne trouve rien et clique sur cette CTA principale obtient un silence total. C'est précisément le moment du parcours où la création d'alerte a le plus de valeur.

**Correctif suggéré :** Passer onCreateAlert (déjà disponible dans SearchResults) en prop à SearchResultsList et le câbler sur ce bouton : <Button variant="outline" onClick={onCreateAlert} disabled={isCreatingAlert}>. Ou supprimer le bouton si la CTA du header suffit.

#### ⚪ Libellé 'Premium' en dur (non i18n)
*low · UX/A11y · confiance high* — `src/pages/Search/components/SearchResultsList.tsx:150`

Le badge premium affiche la chaîne littérale 'Premium' codée en dur, alors que tous les autres badges adjacents passent par i18n (t('listings.detail.badges.featured'), t('listings.detail.badges.boosted'), t('listings.badge.companyVerified')). C'est une incohérence : la chaîne n'est pas traduite/centralisée et échappe au système i18n imposé par les conventions du projet.

**Correctif suggéré :** Remplacer le texte 'Premium' par un appel i18n, p.ex. t('listings.detail.badges.premium') (ou la clé existante équivalente), et ajouter la clé fr/en dans translations.ts.

#### ⚪ Tri rendu en cases à cocher avec comportement ambigu
*low · UX/A11y · confiance high* — `src/pages/Search/SearchResults.tsx:1561`

Le tri (choix mutuellement exclusif: recent/priceAsc/priceDesc) est rendu avec des <input type="checkbox"> au lieu de radios. Décocher la case active déclenche handleSortChange('recent') (retour au tri par défaut), ce qui est sémantiquement faux pour des cases à cocher (l'utilisateur s'attend à pouvoir tout décocher) et accessibilité-incohérent : un lecteur d'écran annonce des cases à cocher indépendantes alors que le choix est exclusif. Le composant SortSelect (src/components/ui/SortSelect.tsx) du design system existe précisément pour ça mais n'est utilisé QUE pour son type SortOption (import type), jamais rendu.

**Correctif suggéré :** Utiliser des <input type="radio"> avec un name commun (comme le bloc adType/sellerType voisin) ou réutiliser le composant SortSelect du design system pour garantir l'exclusivité et l'accessibilité.

#### ⚪ 'Vous vouliez dire' affiché en double (header + état vide)
*low · Visuel · confiance high* — `src/pages/Search/components/SearchResultsHeader.tsx:264`

Le bloc 'Vous vouliez dire <label> ?' est rendu deux fois simultanément quand la recherche ne retourne aucun résultat : une fois dans le header (SearchResultsHeader, ligne 264, toujours visible si didYouMean) et une fois dans l'état vide (SearchResultsList, ligne 77). Les deux reçoivent le même didYouMean et le même handler. L'utilisateur voit la suggestion deux fois sur la même page.

**Correctif suggéré :** N'afficher la suggestion 'did you mean' qu'à un seul endroit : soit la masquer dans le header quand il n'y a aucun résultat, soit ne pas la dupliquer dans l'état vide.

#### ⚪ Pas d'indication de rechargement quand des résultats sont déjà affichés
*low · UX/A11y · confiance high* — `src/pages/Search/components/SearchResultsList.tsx:62`

Le message de chargement n'est rendu que si isLoading && !listings.length. Lors d'un changement de filtre/page alors que des résultats sont déjà présents, isLoading repasse à true mais aucun feedback visuel n'apparaît (ni overlay, ni dimming, ni spinner) ; l'ancienne liste reste figée jusqu'au remplacement brutal. Le projet fournit LoadingOverlay/Skeleton dans components/ui justement pour ce cas. Combiné au fait que la pagination ne se désactive que via disabled={... || isLoading}, l'utilisateur n'a aucun signal que sa nouvelle requête est en cours.

**Correctif suggéré :** Afficher un état de rechargement même quand listings.length > 0 : envelopper la grille dans un LoadingOverlay (components/ui/LoadingOverlay) ou appliquer une classe de dimming + Skeleton pendant isLoading.

#### ⚪ Réponse /search/suggestions consommée sans garde de forme par item
*low · API/Data · confiance high* — `src/pages/Search/SearchResults.tsx:409`

Le résultat de apiGet<SearchQuerySuggestion[]>('/search/suggestions?...') n'est validé que par Array.isArray(items). Chaque item est ensuite traité comme ayant item.query/item.label (resolveDidYouMeanCandidate ligne 112 fait normalizeDidYouMeanValue(item.query), quickSuggestionQueries lit item.query, l'affichage lit item.label). Si l'API renvoie un élément sans query (null/undefined), normalizeDidYouMeanValue(undefined) lèvera une TypeError (.toLowerCase sur undefined) dans le .then, non capturée par le catch de l'appel (l'erreur est dans le callback then synchrone -> rejette la promesse -> tombe dans catch qui vide tout, donc suggestions silencieusement perdues). La donnée distante est affichée/traitée sans garde par champ.

**Correctif suggéré :** Filtrer/normaliser les items après réception : ne garder que ceux où typeof item.query === 'string' && item.query.trim(), avec fallback label = item.label || item.query, avant de les stocker dans querySuggestions.

#### ⚪ useEffect de reset prix dépend d'un callback recréé à chaque rendu
*low · Bug/Logique · confiance high* — `src/pages/Search/SearchResults.tsx:1230`

L'effet (ligne 1222) liste handlePriceBandChange dans ses dépendances. handlePriceBandChange n'est pas mémoïsé (recréé à chaque rendu), donc la dépendance change à chaque rendu ; l'effet n'est protégé d'une boucle que par sa condition interne (activeCategory && !hasPriceStep && prix présent). C'est fragile : toute évolution de la condition ou du callback peut réintroduire des exécutions répétées / appels setSearchParams en cascade. Même remarque pour les deps useMemo sur searchParamsString vs searchParams aux lignes 174-176 et 233 (attributeFiltersFromUrl recalculé sur searchParamsString mais lit searchParams — incohérence de dépendance qui peut donner une valeur périmée).

**Correctif suggéré :** Mémoïser handlePriceBandChange avec useCallback (ou inliner la logique de reset dans l'effet) et retirer le callback des deps. Pour parseAttributeFiltersFromParams, dériver depuis searchParamsString de façon cohérente (reconstruire un URLSearchParams à partir de searchParamsString dans le useMemo).

---

### Authentification  ·  6 findings (🟡2 ⚪4)

#### 🟡 Le rôle moderator est redirigé vers /admin mais le guard le renvoie vers /dashboard
*medium · Bug/Logique · confiance high* — `src/pages/Auth/Login.tsx:43`

Après connexion, Login traite role === 'admin' || role === 'moderator' comme admin et navigue vers /admin (lignes 42-44). Mais dans useAuth, isAdmin est calculé uniquement avec role === 'admin' (useAuth.ts ligne 195) et le type AuthUser n'inclut pas 'moderator' (useAuth.ts lignes 7-9). Le guard ProtectedRoute applique alors `requireAdmin && !isAdmin` -> Navigate vers /dashboard (AppRouter.tsx lignes 112-113). Un modérateur se connecte, est envoyé vers /admin, puis aussitôt rejeté vers /dashboard : l'accès à l'espace admin/modération est cassé pour ce rôle.

**Correctif suggéré :** Aligner la définition du rôle : ajouter 'moderator' au type union de AuthUser et faire en sorte que isAdmin (ou un nouveau isModerator/isStaff) couvre 'admin' et 'moderator', puis utiliser cette même logique dans Login.tsx et dans le guard requireAdmin de AppRouter.tsx.

#### 🟡 Instruction technique '?token=' affichée à l'utilisateur final après demande de réinitialisation
*medium · UX/A11y · confiance high* — `src/pages/Auth/ForgotPassword.tsx:84`

Le bloc de feedback affiche systématiquement, en plus du message serveur, 'Le lien reçu doit contenir ?token= pour fonctionner' (clés auth.forgot.feedbackTokenPrefix/Suffix). C'est une instruction de debug/développeur exposée à tout utilisateur normal, déroutante et peu professionnelle. De plus elle s'affiche même quand le serveur renvoie un message neutre anti-énumération de comptes.

**Correctif suggéré :** Retirer l'affichage du fragment ?token= côté utilisateur. Se contenter du message renvoyé par l'API (response.message) ou du fallback auth.forgot.feedbackDefault.

#### ⚪ Erreur de chargement de session traduite avec une clé de connexion inadaptée
*low · UX/A11y · confiance medium* — `src/hooks/useAuth.ts:117`

Quand fetchCurrentUser échoue (erreur réseau sur /users/me), le message d'erreur fallback utilise t('auth.login.error') ('Impossible de vous connecter.'). Or l'utilisateur a déjà un token et n'est pas en train de se connecter ; ce message est trompeur, et il est ensuite affiché tel quel par le RetryBanner du guard (AppRouter.tsx lignes 93-101).

**Correctif suggéré :** Utiliser une clé dédiée du type auth.session.loadError ('Impossible de charger votre session, réessayez.') plutôt que de réutiliser auth.login.error.

#### ⚪ Case 'Rester connecté' non câblée (aucun effet)
*low · Bug/Logique · confiance high* — `src/pages/Auth/Login.tsx:99`

La checkbox login-remember (lignes 97-102) n'a ni state, ni onChange, ni lecture lors du submit. Le token est toujours stocké en localStorage de façon persistante (auth-token.ts setAuthToken). La promesse faite à l'utilisateur ('Rester connecté' / sessionStorage vs localStorage) n'est jamais honorée : la case est purement décorative.

**Correctif suggéré :** Soit retirer la case, soit la câbler : stocker le token en sessionStorage quand non cochée et en localStorage quand cochée (paramétrer setAuthToken avec un flag persistant).

#### ⚪ setTimeout de redirection post-reset sans nettoyage au démontage
*low · Bug/Logique · confiance high* — `src/pages/Auth/ResetPassword.tsx:81`

Après succès, un setTimeout de 2s déclenche navigate('/login') (lignes 81-83). Il n'est jamais stocké ni nettoyé. Si l'utilisateur quitte la page avant 2s, la navigation se déclenche quand même (et React peut avertir d'un état/navigation sur composant démonté). C'est aussi une condition de course si plusieurs soumissions réussissent.

**Correctif suggéré :** Stocker l'id du timeout et le clearTimeout dans un cleanup (useEffect ou ref), ou rediriger immédiatement après le toast.

#### ⚪ Inscription : aucune validation côté client de la force/longueur du mot de passe
*low · Bug/Logique · confiance high* — `src/pages/Auth/Register.tsx:157`

Le champ mot de passe d'inscription n'impose ni minLength ni règle, alors que ResetPassword exige password.length >= 8 (ResetPassword.tsx ligne 58) et que le hint auth.register.passwordHint suggère des contraintes. L'utilisateur n'a de feedback qu'après l'aller-retour serveur (error.message brut affiché ligne 99). Incohérence de parcours entre inscription et réinitialisation.

**Correctif suggéré :** Ajouter minLength={8} (et idéalement la même validation que ResetPassword) sur l'Input mot de passe d'inscription, avec message i18n dédié avant l'appel API.

---

### Dashboard — messagerie  ·  6 findings (🟡3 ⚪3)

#### 🟡 Échec d'envoi : le message reste avec deliveryStatus 'sent' (aucun état d'erreur visuel)
*medium · Bug/Logique · confiance high* — `src/pages/Dashboard/Conversation.tsx:547`

Dans handleSendMessage, en cas d'échec réseau (catch ligne 545), le message optimiste est conservé avec `deliveryStatus: 'sent'` et un suffixe texte '(Envoi impossible)' concaténé au contenu. Le type ConversationMessage.deliveryStatus ne possède pas de valeur 'failed' (messages.ts ligne 42 : 'sent' | 'delivered' | 'read'), donc visuellement le message affiche toujours le simple '✔' (ligne 894-901) comme s'il était parti. Pire : au prochain poll (pollLatestMessages, 10s), updateMessages fait un merge par id ; le message échoué garde un tempId qui n'existe pas côté serveur, donc il reste affiché indéfiniment comme un faux message envoyé, sans possibilité de renvoi. Le texte du suffixe est en plus injecté dans le contenu (mélange données/présentation).

**Correctif suggéré :** Introduire un statut d'échec dédié (ex. ajouter 'failed' au type ou un flag `error: true` sur le message optimiste), afficher une icône d'erreur + bouton 'Réessayer', et ne pas modifier `content`. Retirer le message optimiste échoué ou le marquer pour qu'il ne soit pas confondu avec un message réellement envoyé.

#### 🟡 Nombreuses chaînes en dur (français) non passées par i18n
*medium · UX/A11y · confiance high* — `src/pages/Dashboard/Conversation.tsx:750`

Plusieurs textes visibles sont codés en dur en français, contournant le système i18n alors que le reste du composant utilise t(). Exemples : Conversation.tsx — 'Génération...' / 'Réponse IA' (l.750-751), tout le bloc Actions livraison ('Actions livraison' l.780, 'Statut:' / 'Paiement sécurisé:' l.782-783, 'Remettre le colis' l.789, 'Renvoyer le code SMS' l.794, 'Confirmer le retrait' l.801, 'Confirmer la livraison' l.806, 'Confirmer la réception' l.813, 'Annuler' l.818, 'Code de remise:' l.825), les window.prompt() (l.694, 706, 728), les toasts d'erreur livraison ('Livraison' / "Impossible d'exécuter cette action..." l.644-646), le toast IA ('IA indisponible' l.622). Les fonctions formatDeliveryStatus (l.52) et formatEscrowStatus (l.69) renvoient des libellés FR en dur. Dans Messages.tsx : 'Réponses automatiques IA' (l.954), 'Activer les réponses automatiques' (l.964), 'Délai minimum avant auto-réponse (minutes)' (l.969), 'Limite d'auto-réponses par 24h' (l.987), et les hints '5 à 720 minutes...' (l.984), '1 à 10 réponses...' (l.1002). En mode anglais, l'UI sera incohérente (mélange FR/EN).

**Correctif suggéré :** Extraire toutes ces chaînes vers src/i18n/translations.ts (clés FR + EN) et les consommer via t(). Pour les window.prompt, remplacer par une modale i18n (les prompts natifs ne sont pas stylables ni traduisibles de façon cohérente).

#### 🟡 Bloc Actions livraison stylé en inline avec couleurs hardcodées au lieu du SCSS / design system
*medium · Visuel · confiance high* — `src/pages/Dashboard/Conversation.tsx:761`

Le panneau 'Actions livraison' (l.760-828) est entièrement stylé via des style inline avec des couleurs codées en dur (background '#f8fafc', border 'rgba(148,163,184,0.3)', color '#64748b', '#0f172a') au lieu d'utiliser les classes SCSS du projet (pas de Tailwind/MUI ici). Idem pour les blocs de chargement (l.837 color '#6c757d') et les nombreux style={{...}} de Messages.tsx (réseau de gap/grid inline). Cela contourne le design system, casse la cohérence thème (mode sombre / tokens) et nuit à la maintenabilité.

**Correctif suggéré :** Extraire ces styles vers les feuilles SCSS (src/assets/scss) avec des classes dédiées (ex. .delivery-actions, .delivery-actions__status) utilisant les variables de couleur du thème, plutôt que des hex/rgba en dur inline.

#### ⚪ Indicateur de lecture identique pour 'delivered' et 'read'
*low · UX/A11y · confiance high* — `src/pages/Dashboard/Conversation.tsx:896`

L'indicateur de remise rend '✔✔' à la fois pour deliveryStatus 'read' et 'delivered' (lignes 896-900). L'utilisateur ne peut donc pas distinguer 'remis' de 'lu', ce qui annule l'intérêt du double-check de lecture. De plus ces glyphes (✔ / ✔✔) sont des caractères en dur sans label accessible : un lecteur d'écran lira 'coche coche' sans signification.

**Correctif suggéré :** Différencier visuellement lu vs remis (ex. couleur du ✔✔ pour 'read', ou ✓/✓✓ vs ✓✓ bleu) et ajouter un aria-label/title traduit (ex. t('...read'), t('...delivered'), t('...sent')) sur le span message-delivery.

#### ⚪ useMessageNotifications : navigation via window.location.assign (full page reload, perte SPA)
*low · UX/A11y · confiance high* — `src/hooks/useMessageNotifications.ts:70`

L'action du toast 'nouveau message' navigue avec `window.location.assign('/dashboard/messages/<id>')` (l.70). Dans une SPA react-router-dom v6, cela force un rechargement complet de la page (perte d'état, re-bootstrap de l'app, flash blanc), au lieu d'une navigation client. Le hook n'a pas accès à useNavigate ici mais devrait l'utiliser.

**Correctif suggéré :** Utiliser le hook useNavigate() de react-router-dom et appeler navigate(`/dashboard/messages/${conversation.id}`) dans l'action du toast pour une navigation SPA sans rechargement.

#### ⚪ useMessageNotifications ignore le rôle 'courier' pour le calcul des non-lus
*low · Bug/Logique · confiance high* — `src/hooks/useMessageNotifications.ts:43`

Le calcul isUnread (l.43-46) ne gère que buyer/seller : `conversation.buyer.id === user.id ? unreadCountBuyer > 0 : unreadCountSeller > 0`. Pour un utilisateur qui est le courier de la conversation (type prévoit courier + unreadCountCourier, messages.ts l.18/23), il sera traité comme 'seller' par défaut et lira unreadCountSeller (faux), donc pas de toast pour ses propres messages non lus. Messages.tsx gère correctement ce cas via getConversationUnreadForUser (l.125-142) ; le hook global devrait être aligné.

**Correctif suggéré :** Réutiliser une fonction partagée équivalente à getConversationUnreadForUser (buyer/seller/courier) dans useMessageNotifications.ts plutôt que la condition binaire, et exporter cette fonction depuis un util commun pour éviter la duplication.

---

### Dashboard — paiements & wallet  ·  6 findings (🟡2 ⚪4)

#### 🟡 Wallet.tsx entièrement en texte FR codé en dur, hors du système i18n
*medium · UX/A11y · confiance high* — `src/pages/Dashboard/Wallet.tsx:292`

Contrairement à Payments.tsx qui passe systématiquement par useI18n()/t(), toute la page Wallet affiche des chaînes FR codées en dur : titres ('Wallet', 'Solde actuel', 'Historique des transactions', 'Recharger le wallet', 'Retirer mes gains'), boutons ('Actualiser', 'Export CSV', 'Recharger', 'Retirer', 'Charger plus'), filtres ('Toutes', 'Recharges', 'Retraits', 'Versements', 'Tous statuts', 'Confirmés', etc.), labels checklist, statuts de transaction (Confirmé/En attente/Échec lignes 440-445), typeLabels (lignes 251-258) et tous les messages de toast/erreur. La page est donc non traduisible en anglais alors que l'app supporte fr/en. Aucune clé 'dashboard.wallet.*' n'existe dans translations.ts.

**Correctif suggéré :** Importer useI18n et déplacer toutes les chaînes visibles vers des clés 'dashboard.wallet.*' dans translations.ts (sections fr ET en), comme c'est fait pour 'dashboard.payments.*'. Inclure typeLabels, statuts de transaction et messages de toast.

#### 🟡 Double appel initial et boucle potentielle sur loadTransactions
*medium · Bug/Logique · confiance high* — `src/pages/Dashboard/Wallet.tsx:130`

Deux useEffect dépendent de loadTransactions (lignes 130-133 et 135-137). Au montage, les deux s'exécutent → /payments/wallet/transactions est appelé deux fois. De plus, loadTransactions a 'transactions.length' dans ses deps (ligne 127) : chaque mise à jour de la liste recrée la callback, ce qui re-déclenche le 2e useEffect (deps incluent loadTransactions) et relance un fetch 'reset'. C'est une source de requêtes redondantes et d'effets en cascade difficile à raisonner.

**Correctif suggéré :** Retirer 'transactions.length' des deps de useCallback et passer l'offset en argument explicite à loadTransactions('more', offset). Fusionner les deux useEffect en un seul (déps : filterType, filterStatus, dateFrom, dateTo) pour ne charger qu'une fois par changement de filtre, et charger le summary séparément au montage uniquement.

#### ⚪ Aucun AbortController : conditions de course et setState après démontage
*low · Bug/Logique · confiance high* — `src/pages/Dashboard/Wallet.tsx:73`

loadSummary et loadTransactions n'utilisent pas de signal d'annulation. Si l'utilisateur change rapidement de filtre (ou quitte la page), des réponses obsolètes peuvent arriver dans le désordre et écraser l'état le plus récent (la dernière réponse réseau n'est pas forcément celle du dernier filtre), et un setState peut survenir après démontage. Payments.tsx, lui, gère correctement l'abort via AbortController (lignes 282-287).

**Correctif suggéré :** Passer un AbortSignal à apiGet (l'API le supporte déjà via options.signal) et annuler la requête précédente dans le cleanup du useEffect, sur le modèle de Payments.tsx.

#### ⚪ Couleurs et styles codés en dur au lieu du design system SCSS
*low · Visuel · confiance high* — `src/pages/Dashboard/Wallet.tsx:510`

La page réinvente des styles inline avec des couleurs hex codées en dur (#0f172a, #334155, #15803d, #b45309, #e2e8f0, #f8fafc, #64748b, rgba(15,23,42,0.08)) pour la checklist, les statuts et les séparateurs de transactions (lignes 431, 439, 510-552). Ces palettes (slate/Tailwind) ne correspondent pas aux couleurs utilisées ailleurs (ex. Payments.tsx utilise #0d6efd, #6c757d) ni aux classes SCSS du design system. Les badges de statut n'utilisent pas la classe partagée 'admin-status' employée dans Payments.tsx.

**Correctif suggéré :** Remplacer les couleurs/styles inline par des classes SCSS du thème et réutiliser le composant/classe de badge de statut ('admin-status--*') déjà présent dans Payments.tsx pour la cohérence visuelle.

#### ⚪ Finalisation de session de paiement sans feedback de chargement visible
*low · UX/A11y · confiance high* — `src/pages/Dashboard/Payments.tsx:225`

Quand l'utilisateur revient de Stripe avec ?session_id=..., finalizeSession s'exécute et met isFinalizingSession à true, mais cet état ne sert qu'à désactiver les boutons 'Actualiser' (lignes 662, 687, 868). Aucun indicateur visible (spinner/bannière) n'informe l'utilisateur que sa confirmation de paiement est en cours de traitement ; le contenu déjà chargé reste affiché tel quel et le toast n'apparaît qu'à la fin. Le résultat de paiement peut sembler ne rien se passer pendant l'appel réseau.

**Correctif suggéré :** Afficher un indicateur explicite (bannière/overlay 'Confirmation du paiement en cours…') tant que isFinalizingSession est true, en réutilisant LoadingOverlay/RetryBanner du design system.

#### ⚪ États de chargement réduits à un texte 'Chargement...' au lieu des composants partagés
*low · Visuel · confiance high* — `src/pages/Dashboard/Wallet.tsx:303`

Les états de chargement du solde (ligne 303-304), des transactions (ligne 409-410) et de l'empty state (ligne 411-412) utilisent un simple <p>Chargement...</p> / <p>Aucune transaction...</p> codé en dur, alors que le design system fournit Skeleton, EmptyState et LoadingOverlay. Incohérence avec le reste du dashboard.

**Correctif suggéré :** Utiliser Skeleton pour le chargement et EmptyState pour 'Aucune transaction' afin d'harmoniser avec les composants UI partagés.

---

### Design system, layouts & routing (transverse)  ·  6 findings (🟡3 ⚪3)

#### 🟡 La route /listings/edit/:id n'est pas protegee alors que /listings/new l'est
*medium · Bug/Logique · confiance high* — `src/router/AppRouter.tsx:162`

La route '/listings/edit/:id' rend directement <EditListing /> sans <ProtectedRoute>, contrairement a '/listings/new' (ligne 159-161) qui est enveloppee. EditListing.tsx ne contient aucun garde-fou interne (pas de useAuth, pas de redirection vers /login - verifie: le fichier n'importe ni useAuth ni Navigate). Un utilisateur non authentifie peut donc atteindre le formulaire d'edition d'une annonce, qui appellera ensuite des endpoints proteges et echouera de maniere incoherente (ou exposera l'UI d'edition sans session). Incoherence claire avec NewListing.

**Correctif suggéré :** Envelopper la route dans <ProtectedRoute element={<EditListing />} /> exactement comme /listings/new, afin de rediriger vers /login si non authentifie et d'afficher l'etat loading/error du garde.

#### 🟡 Modal sans gestion clavier (Escape), sans focus trap ni scroll-lock
*medium · UX/A11y · confiance high* — `src/components/ui/Modal.tsx:16`

Le composant Modal (utilise dans ~20 pages) n'a aucun useEffect: pas de fermeture via la touche Escape, pas de piege a focus (focus trap), pas de mise du focus initial sur la modale a l'ouverture, et pas de verrouillage du scroll du body. C'est un dialog role='dialog' aria-modal='true' mais le focus reste sur le contenu sous-jacent et l'utilisateur clavier ne peut pas fermer ni naviguer correctement. Probleme d'accessibilite reel pour un composant central du design system.

**Correctif suggéré :** Ajouter un useEffect (actif quand open) qui: ecoute keydown Escape -> onClose, place le focus sur le premier element focusable / le bouton close, restaure le focus a la fermeture, et applique document.body.style.overflow='hidden' avec cleanup.

#### 🟡 Le changement de locale ne met pas a jour <html lang>
*medium · UX/A11y · confiance high* — `src/contexts/I18nContext.tsx:49`

L'effet de I18nProvider (ligne 49-59) met a jour setApiLocale et localStorage mais ne synchronise jamais l'attribut lang de l'element <html> (document.documentElement.lang). L'app reste annoncee dans la langue declaree statiquement dans index.html quel que soit le choix utilisateur, ce qui degrade l'accessibilite (lecteurs d'ecran, moteur de prononciation) et le SEO multilingue.

**Correctif suggéré :** Dans le useEffect dependant de locale, ajouter: if (typeof document !== 'undefined') document.documentElement.lang = locale.

#### ⚪ id='modal-title' code en dur -> collision si plusieurs modales et aria-labelledby casse
*low · Bug/Logique · confiance high* — `src/components/ui/Modal.tsx:32`

Le titre utilise un id statique 'modal-title' (ligne 36) reference par aria-labelledby (ligne 32). Plusieurs pages montent plusieurs <Modal> dans le meme arbre (ex: ListingDetail.tsx en a 4, Messages.tsx 3, Settings.tsx 2). Si deux modales sont ouvertes simultanement, l'id 'modal-title' devient duplique dans le DOM et aria-labelledby pointe vers un noeud ambigu, cassant l'annonce du titre par les lecteurs d'ecran. De plus la modale sans title n'a aucun nom accessible (aria-labelledby=undefined et pas d'aria-label de secours).

**Correctif suggéré :** Generer l'id via useId() et le partager entre le <h3 id={titleId}> et aria-labelledby={title ? titleId : undefined}. Optionnellement, fournir un aria-label de repli quand title est absent.

#### ⚪ Etat loading du garde de route stylise en inline au lieu du SCSS
*low · Visuel · confiance high* — `src/router/AppRouter.tsx:80`

ProtectedRoute applique un bloc de style inline code en dur (padding '3rem 1.5rem', display grid, gap '12px', justifyItems) sur .route-guard-loading (ligne 80-86). Aucune regle SCSS n'existe pour cette classe (verifie: aucune occurrence de 'route-guard-loading' dans src/assets/scss). Cela contourne le design system base sur SCSS et hardcode espacements/valeurs au lieu d'utiliser les variables de theme.

**Correctif suggéré :** Deplacer ces styles dans une regle .route-guard-loading du SCSS en utilisant les variables d'espacement existantes, et retirer l'objet style inline.

#### ⚪ LoadingOverlay ajoute un '…' au libelle qui en contient deja un (EN)
*low · Visuel · confiance high* — `src/components/ui/LoadingOverlay.tsx:24`

Le rendu affiche {label}… (ligne 24) en ajoutant systematiquement des points de suspension. Or la traduction anglaise 'loading.global.single' vaut deja 'Loading…' (translations.ts ligne 2398), produisant 'Loading……'. L'ajout d'un suffixe de ponctuation hors i18n est aussi une mauvaise pratique (la ponctuation devrait faire partie de la chaine traduite).

**Correctif suggéré :** Inclure les points de suspension directement dans les chaines i18n (les harmoniser entre FR/EN) et retirer le '…' code en dur du JSX, ou ne l'ajouter qu'une seule fois de maniere coherente.

---

### Dashboard — accueil/aperçu  ·  5 findings (🟡1 ⚪4)

#### 🟡 DashboardHome n'offre aucun retry sur l'erreur de chargement principal
*medium · UX/A11y · confiance high* — `src/pages/Dashboard/DashboardHome.tsx:332`

Quand l'appel /dashboard/overview échoue, la page n'affiche qu'un <p className="auth-form__error"> figé. Aucun bouton/affordance pour relancer le chargement: l'utilisateur doit recharger toute la page. C'est incohérent avec DashboardOverview.tsx qui utilise RetryBanner avec onRetry, et avec le reste de l'app (existence de la clé actions.retry / composant RetryBanner). Le fetch est dans un useEffect sans fonction réutilisable, donc aucun moyen de réémettre la requête.

**Correctif suggéré :** Extraire le fetch dans un loadOverview useCallback (comme DashboardOverview), et remplacer le <p> d'erreur par <RetryBanner title=... message={error} onRetry={loadOverview} /> pour aligner le pattern et permettre la reprise sans reload.

#### ⚪ État de chargement avec couleur hardcodée et sans skeleton
*low · Visuel · confiance high* — `src/pages/Dashboard/DashboardHome.tsx:327`

Le loading est un <p style={{ padding: '1.5rem 0', color: '#6c757d' }}> : couleur et espacement codés en dur au lieu du SCSS du design system, et simple texte là où DashboardOverview affiche un Skeleton. Idem ligne 462 (Modal: style={{ marginBottom: '1rem' }}) et ligne 327. Incohérent avec la convention SCSS du projet (pas de styles inline).

**Correctif suggéré :** Remplacer le texte de chargement par des Skeleton (composant ui/Skeleton déjà utilisé dans DashboardOverview) et déplacer padding/couleur/margin vers une classe SCSS dédiée (ex: .dashboard-page__loading).

#### ⚪ DashboardOverview est du code mort (jamais routé ni importé)
*low · Bug/Logique · confiance high* — `src/pages/Dashboard/DashboardOverview.tsx:13`

Recherche dans tout src/: DashboardOverview n'est importé/monté nulle part (AppRouter ne route que DashboardHome sur /dashboard). Les seules occurrences de '/dashboard/overview' hors ce fichier sont l'URL de données consommée par DashboardHome et des tests. Ce composant complet (insights vendeur pro/individuel) est donc inaccessible aux utilisateurs — soit un câblage de route manquant, soit du mort à supprimer. La donnée sellerInsights du type DashboardOverviewResponse n'est exploitée nulle part dans DashboardHome non plus.

**Correctif suggéré :** Décider: soit ajouter une route (ex: /dashboard/overview -> ProtectedRoute element={<DashboardOverview />}) et un lien dans la Sidebar, soit supprimer le fichier. Si conservé, exposer aussi les sellerInsights dans DashboardHome ou via le menu.

#### ⚪ Clés de liste non garanties uniques (reminders/stats/messages)
*low · Bug/Logique · confiance high* — `src/pages/Dashboard/DashboardHome.tsx:360`

Les listes utilisent des champs de contenu comme clés React: stats keyed par stat.label (ligne 341), reminders par reminder.title (ligne 360), messages par `${message.from}-${message.time}` (ligne 386). Aucun de ces champs n'a d'unicité garantie côté type (DashboardStat/DashboardReminder/DashboardMessageDigest n'ont pas d'id). Deux rappels de même titre, deux stats de même label, ou deux messages du même expéditeur à la même heure provoquent des clés dupliquées => warnings React et bugs de réconciliation (état/animation mélangés).

**Correctif suggéré :** Ajouter un id stable côté API/type, ou à défaut composer la clé avec l'index: key={`${reminder.title}-${index}`} etc. Idéalement enrichir les types dashboard.ts avec un champ id.

#### ⚪ Dates de notification affichées sans garde de validité
*low · Bug/Logique · confiance high* — `src/pages/Dashboard/DashboardHome.tsx:281`

new Date(notification.created_at).toLocaleString(dateLocale) est rendu sans vérifier que created_at est une date valide. Si l'API renvoie une valeur nulle/mal formée (le type garantit string mais pas la validité ISO), l'affichage devient 'Invalid Date' visible par l'utilisateur. Pas de fallback.

**Correctif suggéré :** Encapsuler dans un helper qui teste Number.isNaN(date.getTime()) et retourne un placeholder i18n (ou masque la <time>) en cas de date invalide.

---

### Dashboard — profil & paramètres  ·  4 findings (🟡2 ⚪2)

#### 🟡 Toute la section Livraison/livreur est en texte français codé en dur (pas d'i18n)
*medium · UX/A11y · confiance high* — `src/pages/Dashboard/Settings.tsx:990`

Toute la section 'Livraison' (titre 'Livraison' L990, description L992, 'Je souhaite être livreur particulier' L1003, le bloc 'Vérification livreur' L1010-1047, les libellés de FormField 'Ville du livreur'/'Code postal'/'Latitude'/'Longitude'/'Rayon d'intervention' L1051-1093, les boutons 'Localiser automatiquement'/'Enregistrer la localisation' L1110-1114) ainsi que tous les toasts associés (handleCourierGeocode L563-595, handleCourierSave L620-628, handleCourierDocumentUpload L642-651) utilisent des chaînes françaises en dur. Le reste du fichier passe systématiquement par t(). En mode anglais l'UI sera partiellement en français, et ces chaînes n'existent pas dans translations.ts (vérifié: aucune clé dashboard.settings.delivery/courier). Régression d'accessibilité linguistique et incohérence évidente.

**Correctif suggéré :** Extraire toutes ces chaînes vers des clés i18n (ex: dashboard.settings.delivery.title, .courierToggle, .verification.*, .city, .zipcode, .lat, .lng, .radius, .geocode, .save, et les toasts) et les ajouter aux blocs fr ET en de translations.ts, puis remplacer par t('...').

#### 🟡 Profile refait un GET /users/me redondant et hydrate l'état deux fois
*medium · API/Data · confiance high* — `src/pages/Dashboard/Profile.tsx:319`

Dans l'effet (L245-377), quand `user` existe on hydrate TOUT l'état depuis l'objet user (L319-370) puis on appelle quand même `loadProfile(!user)` (L371) qui déclenche un second GET /users/me (sans spinner) à chaque montage. De plus l'effet dépend de `[t, user, isPro]` (L377): un simple changement de langue (`t` change d'identité) ou de flag re-déclenche un appel réseau /users/me et réécrase l'état du formulaire en cours d'édition — risque de perte des champs non sauvegardés saisis par l'utilisateur si la locale change pendant l'édition.

**Correctif suggéré :** Ne pas dépendre de `t` dans cet effet (déplacer le message d'erreur par défaut hors closure ou via ref). Quand `user` est présent et complet, éviter le GET redondant (ne fetcher que si user absent), et ne pas réhydrater `form` si l'utilisateur a déjà modifié des champs (garder un flag 'dirty').

#### ⚪ Les toggles de notifications/privacy ne se bloquent pas pendant qu'un autre est en cours
*low · Bug/Logique · confiance high* — `src/pages/Dashboard/Settings.tsx:412`

handleSettingToggle (L407-437) n'a qu'un seul verrou `updatingSetting` (string|null) et ne désactive QUE la case en cours (`disabled={updatingSetting === key}`). Si l'utilisateur clique rapidement une autre case pendant qu'une requête est en vol, le test `previousValue === nextValue || updatingSetting` (L412) prend la branche qui met à jour l'état localement SANS appeler updateSettings: le changement de la 2e case est appliqué visuellement mais jamais persisté côté serveur, créant une divergence silencieuse UI/backend.

**Correctif suggéré :** Soit gérer une file/identifiant par clé permettant des requêtes concurrentes, soit désactiver toutes les cases tant que `updatingSetting` est non nul, soit, dans la branche court-circuit, ne pas modifier l'état (ignorer le clic) au lieu d'appliquer un changement non persisté.

#### ⚪ Bouton 'Aide' de l'en-tête Paramètres sans action
*low · UX/A11y · confiance high* — `src/pages/Dashboard/Settings.tsx:882`

Le bouton `<Button variant="outline">{t('dashboard.settings.help')}</Button>` (L882) n'a aucun onClick ni href: il est cliquable mais ne fait rien. Contrôle mort qui induit l'utilisateur en erreur.

**Correctif suggéré :** Lui associer une action (lien vers la page d'aide/FAQ, ouverture d'un modal, ou mailto support) ou le retirer.

---
