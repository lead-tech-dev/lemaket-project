# LEMAKET Mobile (Expo SDK 54)

Application mobile Expo pour LEMAKET, connectée au backend NestJS existant.

## Prérequis

1. Node.js 20+
2. npm 10+
3. Expo CLI (`npx expo` suffit)
4. Backend lancé sur `http://localhost:3000` (ou `http://<IP-LAN>:3000` sur téléphone réel)

## Setup

1. Copier les variables d'environnement:

```bash
cp .env.example .env
```

2. Installer les dépendances:

```bash
npm install
```

3. Lancer l'app:

```bash
npm run start
```

## Scripts

- `npm run start` - démarre Expo
- `npm run android` - lance Android (build native locale)
- `npm run ios` - lance iOS (build native locale)
- `npm run web` - lance en web
- `npm run typecheck` - vérification TypeScript
- `npm run lint` - lint

## Variable d'environnement

- `EXPO_PUBLIC_API_URL` : URL du backend API (ex: `http://localhost:3000`)
  - Sur téléphone réel, utiliser l'IP LAN de ta machine: `http://192.168.x.x:3000`

## Fonctionnalités implémentées (V1 foundation)

1. Auth login avec token sécurisé (`expo-secure-store`)
2. Auth register
3. Navigation protégée (`expo-router`)
4. Home avec annonces récentes (`/listings/latest`)
5. Recherche localisation avec autocomplete geo (`/geo/autocomplete`)
6. Détail annonce + bouton contact vendeur
7. Mes annonces (`/listings/me`) + suppression
8. NewListing / EditListing mobile en multi-step + upload images (`/media/upload`)
9. Messages: liste conversations + chat (refresh temps réel par polling)
10. Profil + logout

## Design System

- Référence UX mobile: `docs/MOBILE_UX_SYSTEM.md`
- Tokens partagés web/mobile: `src/core/theme/tokens.ts`

## Prochaines étapes

1. New Listing / Edit Listing multi-step
2. Upload média mobile
3. Messages realtime
4. Favoris + alertes
5. Notifications push Expo
