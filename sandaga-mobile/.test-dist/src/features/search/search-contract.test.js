"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const search_contract_1 = require("./search-contract");
(0, node_test_1.default)('buildListingsSearchParams produces canonical listing query', () => {
    const params = (0, search_contract_1.buildListingsSearchParams)({
        page: 2,
        limit: 24,
        term: '  coloc   douala ',
        selectedCity: 'Douala',
        selectedCityIds: ['city-1', 'city-2', 'city-1'],
        selectedNeighborhoodIds: ['n-1', 'n-2'],
        selectedCoordinates: { lat: 4.05, lng: 9.76 },
        filters: {
            categorySlug: 'immobilier',
            priceBand: 'mid',
            radiusKm: '50',
            sort: 'recent',
            sellerType: 'pro',
            adType: 'SELL',
            titleOnly: true
        },
        resolvePriceBand: id => (id === 'mid' ? { min: 10000, max: 50000 } : undefined)
    });
    strict_1.default.equal(params.get('page'), '2');
    strict_1.default.equal(params.get('limit'), '24');
    strict_1.default.equal(params.get('search'), 'coloc douala');
    strict_1.default.equal(params.get('city'), 'Douala');
    strict_1.default.deepEqual(params.getAll('cityIds'), ['city-1', 'city-2']);
    strict_1.default.deepEqual(params.getAll('neighborhoodIds'), ['n-1', 'n-2']);
    strict_1.default.equal(params.get('categorySlug'), 'immobilier');
    strict_1.default.equal(params.get('sellerType'), 'pro');
    strict_1.default.equal(params.get('adType'), 'SELL');
    strict_1.default.equal(params.get('titleOnly'), 'true');
    strict_1.default.equal(params.get('minPrice'), '10000');
    strict_1.default.equal(params.get('maxPrice'), '50000');
    strict_1.default.equal(params.get('lat'), '4.05');
    strict_1.default.equal(params.get('lng'), '9.76');
    strict_1.default.equal(params.get('radiusKm'), '50');
});
(0, node_test_1.default)('buildListingsSearchParams normalizes pagination, ids, category and coordinates', () => {
    const params = (0, search_contract_1.buildListingsSearchParams)({
        page: 0,
        limit: 500,
        term: '  test  ',
        selectedCityIds: [' city-1 ', 'city-1', 'city-2,city-3'],
        selectedNeighborhoodIds: ['n-1', ' n-2 ', ''],
        selectedCoordinates: { lat: 400, lng: 9.76 },
        filters: {
            categorySlug: '  immobilier  ',
            priceBand: 'all',
            radiusKm: 'abc',
            sort: 'recent',
            sellerType: '',
            adType: '',
            titleOnly: false
        },
        resolvePriceBand: () => undefined
    });
    strict_1.default.equal(params.get('page'), '1');
    strict_1.default.equal(params.get('limit'), '100');
    strict_1.default.equal(params.get('categorySlug'), 'immobilier');
    strict_1.default.deepEqual(params.getAll('cityIds'), ['city-1', 'city-2', 'city-3']);
    strict_1.default.deepEqual(params.getAll('neighborhoodIds'), ['n-1', 'n-2']);
    strict_1.default.equal(params.get('lat'), null);
    strict_1.default.equal(params.get('lng'), null);
    strict_1.default.equal(params.get('radiusKm'), null);
});
(0, node_test_1.default)('parseMobileSearchRouteParams supports legacy and canonical route keys', () => {
    strict_1.default.deepEqual((0, search_contract_1.parseMobileSearchRouteParams)({
        category: ['immobilier'],
        q: '  coloc douala  ',
        l: ' Douala '
    }), {
        categorySlug: 'immobilier',
        term: 'coloc douala',
        city: 'Douala'
    });
    strict_1.default.deepEqual((0, search_contract_1.parseMobileSearchRouteParams)({
        categorySlug: 'services',
        search: 'mecanicien',
        city: 'Yaounde'
    }), {
        categorySlug: 'services',
        term: 'mecanicien',
        city: 'Yaounde'
    });
});
