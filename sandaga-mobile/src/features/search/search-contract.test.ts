import test from 'node:test'
import assert from 'node:assert/strict'
import { buildListingsSearchParams, parseMobileSearchRouteParams } from './search-contract'

test('buildListingsSearchParams produces canonical listing query', () => {
  const params = buildListingsSearchParams({
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
  })

  assert.equal(params.get('page'), '2')
  assert.equal(params.get('limit'), '24')
  assert.equal(params.get('search'), 'coloc douala')
  assert.equal(params.get('city'), 'Douala')
  assert.deepEqual(params.getAll('cityIds'), ['city-1', 'city-2'])
  assert.deepEqual(params.getAll('neighborhoodIds'), ['n-1', 'n-2'])
  assert.equal(params.get('categorySlug'), 'immobilier')
  assert.equal(params.get('sellerType'), 'pro')
  assert.equal(params.get('adType'), 'SELL')
  assert.equal(params.get('titleOnly'), 'true')
  assert.equal(params.get('minPrice'), '10000')
  assert.equal(params.get('maxPrice'), '50000')
  assert.equal(params.get('lat'), '4.05')
  assert.equal(params.get('lng'), '9.76')
  assert.equal(params.get('radiusKm'), '50')
})

test('buildListingsSearchParams normalizes pagination, ids, category and coordinates', () => {
  const params = buildListingsSearchParams({
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
  })

  assert.equal(params.get('page'), '1')
  assert.equal(params.get('limit'), '100')
  assert.equal(params.get('categorySlug'), 'immobilier')
  assert.deepEqual(params.getAll('cityIds'), ['city-1', 'city-2', 'city-3'])
  assert.deepEqual(params.getAll('neighborhoodIds'), ['n-1', 'n-2'])
  assert.equal(params.get('lat'), null)
  assert.equal(params.get('lng'), null)
  assert.equal(params.get('radiusKm'), null)
})

test('parseMobileSearchRouteParams supports legacy and canonical route keys', () => {
  assert.deepEqual(
    parseMobileSearchRouteParams({
      category: ['immobilier'],
      q: '  coloc douala  ',
      l: ' Douala '
    }),
    {
      categorySlug: 'immobilier',
      term: 'coloc douala',
      city: 'Douala'
    }
  )

  assert.deepEqual(
    parseMobileSearchRouteParams({
      categorySlug: 'services',
      search: 'mecanicien',
      city: 'Yaounde'
    }),
    {
      categorySlug: 'services',
      term: 'mecanicien',
      city: 'Yaounde'
    }
  )
})
