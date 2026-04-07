# Search Robustness - Phase 1 & 2 (Spec Ready)

## 1) Objective

Deliver a robust, deterministic, and cross-platform search/filter behavior for LEMAKET (web + mobile) with:

- one functional model for filters,
- one canonical API contract,
- strict validation and normalization,
- stable pagination and sorting.

This document is implementation-ready and aligned with the current backend (`/listings`, `/search/suggestions`, `/geo/*`) and current web/mobile query behavior.

---

## 2) Current State (observed)

### Backend

- Main endpoint: `GET /listings` with `FilterListingsDto`.
- Suggestions endpoint: `GET /search/suggestions`.
- Geo endpoints already available (`/geo/autocomplete`, `/geo/cities`, `/geo/neighborhoods`).
- Search ranking already includes:
  - exact/prefix/contains scoring,
  - typo tolerance (`lemaket_similarity`),
  - optional business boosts.
- Listing sort already stabilized with secondary ordering (`created_at`, `id`).

### Web/Mobile

- Web uses URL keys (`q`, `l`, `category`, `radius`) then maps to API keys.
- Mobile already sends most canonical keys directly (`search`, `cityIds`, `neighborhoodIds`, etc.).
- There is still mapping duplication and parameter drift risk between web and mobile.

---

## 3) Phase 1 - Functional Canonical Model

### 3.1 Canonical filters (V1 scope)

1. Text query:
   - `search`
   - `titleOnly`
2. Category:
   - `categorySlug` (preferred),
   - `categoryId` (internal/admin use).
3. Price:
   - `minPrice`,
   - `maxPrice`.
4. Seller/ad type:
   - `sellerType` (`pro|individual`),
   - `adType` (`SELL|BUY|LET|RENT`).
5. Location:
   - single: `cityId`, `neighborhoodId`,
   - multi: `cityIds[]`, `neighborhoodIds[]`,
   - geo radius: `lat`, `lng`, `radiusKm`.
6. Sorting/pagination:
   - `sort` (`recent|priceAsc|priceDesc`),
   - `page`,
   - `limit`.
7. Dynamic attributes:
   - `attributes` (JSON object).

### 3.2 Functional rules (authoritative)

1. Global combination: all active filters are combined with `AND`.
2. Location multi-select rule:
   - within location block only: `cityIds OR neighborhoodIds`,
   - then the location block is `AND` with other filters.
3. Text query logic:
   - include terms/phrases are mandatory,
   - exclude terms/phrases remove candidates.
4. Radius rule:
   - `radiusKm` requires both `lat` and `lng`,
   - missing coordinates with radius => `400`.
5. Price rule:
   - `minPrice <= maxPrice`,
   - otherwise `400`.
6. Default behaviors:
   - `status` defaults to `published` for public queries,
   - `sort` defaults to `recent`,
   - `page=1`, `limit=20` (capped by backend max).
7. Determinism:
   - same filter input must produce same order (stable tie-breaker by `id`).

### 3.3 Acceptance criteria (Phase 1)

1. Query `"coloc"` returns all published listings where title/description/location match ranking rules.
2. Query with exclusion (`coloc -studio`) excludes listings containing excluded term.
3. Multi-location selection returns listings in selected cities OR selected neighborhoods only.
4. Invalid radius payload (`radiusKm` without `lat/lng`) returns `400`.
5. Invalid price range (`minPrice > maxPrice`) returns `400`.
6. Pagination is stable:
   - no duplicates between page N and N+1,
   - no missing items caused by unstable sorting.

---

## 4) Phase 2 - Canonical API Contract

### 4.1 Canonical query contract for `GET /listings`

```txt
search?: string (max 255)
titleOnly?: boolean

categorySlug?: string
categoryId?: uuid

city?: string (legacy, max 120)
cityId?: uuid
cityIds?: uuid[] (csv or repeated params)
neighborhoodId?: uuid
neighborhoodIds?: uuid[] (csv or repeated params)

lat?: number
lng?: number
radiusKm?: number >= 0

minPrice?: number >= 0
maxPrice?: number >= 0

sellerType?: pro|individual
adType?: SELL|BUY|LET|RENT
sort?: recent|priceAsc|priceDesc

attributes?: object (JSON)
status?: ListingStatus (restricted usage)

page?: number >= 1
limit?: number >= 1
```

### 4.2 Cross-platform mapping policy

1. Backend canonical keys are the only source of truth.
2. Web legacy URL aliases stay supported but are normalized server-side:
   - `q -> search`,
   - `l -> city`,
   - `category -> categorySlug`,
   - `radius -> radiusKm`.
3. Mobile keeps canonical keys only.
4. A shared mapping table must be reused by both clients to avoid drift.

### 4.3 Validation and normalization policy

1. Trim/collapse spaces for text (`search`, `city`).
2. Clamp lengths (`search` max 255, `city` max 120).
3. Parse booleans safely (`true/false/1/0/yes/no/on/off`).
4. Parse arrays from:
   - repeated keys (`cityIds=a&cityIds=b`),
   - CSV (`cityIds=a,b`).
5. Reject invalid UUID arrays with `400`.
6. Reject malformed `attributes` JSON with `400`.

### 4.4 Response invariants

1. `PaginatedResult` always includes:
   - `data`,
   - `total`,
   - `page`,
   - `limit`.
2. Optional (recommended in next implementation):
   - `meta.appliedFilters` (debug/observability),
   - `meta.warnings` (e.g., normalized legacy keys).

---

## 5) Implementation Tasks (ready to execute)

### Task A - Shared filter contract package (web + mobile)

Create shared helpers:

- `buildListingsSearchParams(input): URLSearchParams`
- `parseListingsSearchParams(searchParams): CanonicalSearchState`
- `normalizeSearchState(state): CanonicalSearchState`

Target location (suggested):

- `sandaga-frontend/src/features/search/search-contract.ts`
- `sandaga-mobile/src/features/search/search-contract.ts`

Then replace local ad-hoc mapping in:

- `sandaga-frontend/src/pages/Search/SearchResults.tsx`
- `sandaga-mobile/app/(tabs)/search.tsx`

### Task B - Backend strict DTO guardrails

In `FilterListingsDto`:

- keep current validation,
- add explicit constraints for `page/limit` and string max lengths where missing,
- ensure invalid `attributes` parse returns user-facing `400`.

### Task C - Canonical contract tests

1. Unit tests:
   - canonical mapping (web + mobile helpers),
   - normalization rules,
   - invalid payload handling.
2. Integration tests (backend):
   - search + exclusion + typo + location multi-select + pagination stability.
3. Flow test:
   - `"coloc"` scenario (title/description hits).

---

## 6) Definition of Done (Phase 1 + 2)

1. Same search input yields equivalent backend query from web and mobile.
2. All validation errors are deterministic and explicit.
3. No pagination duplicates/missing on sequential pages.
4. Existing flow tests pass and new contract tests pass.
5. No regression on suggestions and geo search.

---

## 7) Remaining after Phase 1 + 2

1. Phase 3: query/index hardening and performance tuning.
2. Phase 4: ranking relevance tuning by vertical/category.
3. Phase 5: advanced UX filters and saved search presets.
4. Phase 6: production SLO/monitoring dashboard for search quality.
