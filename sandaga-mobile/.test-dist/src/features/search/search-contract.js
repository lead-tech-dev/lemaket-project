"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildListingsSearchParams = exports.parseMobileSearchRouteParams = void 0;
const normalizeFreeText = (value, maxLength = 255) => value
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, maxLength);
const toPositiveInt = (value, fallback, max) => {
    if (!Number.isFinite(value)) {
        return fallback;
    }
    const normalized = Math.trunc(value);
    if (normalized < 1) {
        return fallback;
    }
    if (typeof max === 'number') {
        return Math.min(normalized, max);
    }
    return normalized;
};
const normalizeUuidList = (values) => Array.from(new Set(values
    .flatMap(value => value.split(','))
    .map(value => value.trim())
    .filter(Boolean)));
const normalizeRadiusKm = (value) => {
    const parsed = Number.parseFloat(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return undefined;
    }
    return Math.min(parsed, 500);
};
const isValidCoordinate = (lat, lng) => Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180;
const pickParamValue = (value, maxLength = 255) => {
    const raw = Array.isArray(value) ? value[0] : value;
    if (typeof raw !== 'string') {
        return '';
    }
    return normalizeFreeText(raw, maxLength);
};
const parseMobileSearchRouteParams = (params) => {
    const categorySlug = pickParamValue(params.category, 120) || pickParamValue(params.categorySlug, 120);
    const term = pickParamValue(params.q, 255) || pickParamValue(params.search, 255);
    const city = pickParamValue(params.l, 120) || pickParamValue(params.city, 120);
    return {
        categorySlug,
        term,
        city
    };
};
exports.parseMobileSearchRouteParams = parseMobileSearchRouteParams;
const buildListingsSearchParams = (args) => {
    const { page, limit, term = '', selectedCity = '', selectedCityIds = [], selectedNeighborhoodIds = [], selectedCoordinates = null, filters, resolvePriceBand } = args;
    const query = new URLSearchParams();
    query.set('limit', String(toPositiveInt(limit, 20, 100)));
    query.set('page', String(toPositiveInt(page, 1, 100000)));
    query.set('sort', filters.sort);
    const normalizedTerm = normalizeFreeText(term, 255);
    if (normalizedTerm) {
        query.set('search', normalizedTerm);
    }
    if (filters.titleOnly) {
        query.set('titleOnly', 'true');
    }
    const normalizedCity = normalizeFreeText(selectedCity, 120);
    if (normalizedCity) {
        query.set('city', normalizedCity);
    }
    normalizeUuidList(selectedCityIds).forEach(cityId => {
        query.append('cityIds', cityId);
    });
    normalizeUuidList(selectedNeighborhoodIds).forEach(neighborhoodId => {
        query.append('neighborhoodIds', neighborhoodId);
    });
    const normalizedCategorySlug = normalizeFreeText(filters.categorySlug, 120);
    if (normalizedCategorySlug) {
        query.set('categorySlug', normalizedCategorySlug);
    }
    if (filters.sellerType) {
        query.set('sellerType', filters.sellerType);
    }
    if (filters.adType) {
        query.set('adType', filters.adType);
    }
    const priceBand = resolvePriceBand(filters.priceBand);
    if (priceBand?.min !== undefined) {
        query.set('minPrice', String(priceBand.min));
    }
    if (priceBand?.max !== undefined) {
        query.set('maxPrice', String(priceBand.max));
    }
    const radiusKm = normalizeRadiusKm(filters.radiusKm);
    if (selectedCoordinates && isValidCoordinate(selectedCoordinates.lat, selectedCoordinates.lng) && radiusKm) {
        query.set('lat', String(selectedCoordinates.lat));
        query.set('lng', String(selectedCoordinates.lng));
        query.set('radiusKm', String(radiusKm));
    }
    return query;
};
exports.buildListingsSearchParams = buildListingsSearchParams;
