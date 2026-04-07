# LEMAKET Mobile UX System

Ce document fixe la direction UX/UI mobile pour rester coherents avec le web, tout en prenant les meilleurs patterns des apps de petites annonces (Leboncoin, Avito).

## 1) Design system unique Web + Mobile

- Palette source: web (`sandaga-frontend/src/assets/scss/abstracts/_variables.scss`).
- Mobile consomme les memes tokens semantiques (`src/core/theme/tokens.ts`):
  - brand: `primary`, `accent`
  - surfaces: `surface`, `surfaceAlt`, `surfaceMuted`, `background`
  - borders: `border`, `borderStrong`
  - texte: `text`, `muted`, `placeholder`
  - etats: `success`, `warning`, `danger`

## 2) Patterns UX listing-first

- Home orientee action:
  - recherche en haut
  - categories rapides
  - carrousel hero
  - grille 2 colonnes d'annonces
- Navigation basse stable (5 onglets max).
- Cartes annonce lisibles:
  - image dominante
  - prix visible en 1ere lecture
  - localisation courte
- Filtres progressifs:
  - quick filters puis filtres avances dans ecran recherche.

## 3) Regles d'implementation

- Pas de hardcode couleur dans les nouveaux ecrans:
  - utiliser `colors.*`, `spacing.*`, `radius.*`, `typography.*`, `controls.*`, `shadows.*`.
- Toute nouvelle categorie doit afficher:
  - `icon` depuis la BD
  - `gradient` si present, sinon `color`.
- Prioriser la lisibilite mobile:
  - controle min-height >= 44
  - targets tactiles >= 40x40
  - contraste fort sur prix et CTA.

## 4) Prochain lot (P1)

- Uniformiser `messages`, `search`, `my-listings`, `profile` avec les memes tokens semantiques.
- Ajouter composants DS mobiles dedies:
  - `SectionHeader`
  - `PillChip`
  - `ListingTile`
  - `TopSearchBar`
- Ajouter snapshot tests UI de base sur ces composants.
