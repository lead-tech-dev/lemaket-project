import { describe, expect, it } from 'vitest'
import {
  ATTRIBUTE_PARAM_PREFIX,
  buildListingsApiQueryString,
  normalizeAttributeFilters,
  parseAttributeFiltersFromParams,
  parseSearchUrlState
} from './search-contract'

describe('search-contract (web)', () => {
  it('maps legacy keys to canonical listing keys', () => {
    const queryString = buildListingsApiQueryString({
      rawSearchParamsString: 'q=%20coloc%20&l=Douala&category=immobilier&radius=50&lat=4.05&lng=9.76&page=2&limit=30',
      preferences: {
        page: 1,
        limit: 20,
        priceBand: 'all',
        radius: '25'
      },
      defaultPageSize: 20,
      resolvePriceBand: () => undefined,
      attributeFilters: {}
    })

    const params = new URLSearchParams(queryString)
    expect(params.get('search')).toBe('coloc')
    expect(params.get('city')).toBe('Douala')
    expect(params.get('categorySlug')).toBe('immobilier')
    expect(params.get('radiusKm')).toBe('50')
    expect(params.get('page')).toBe('2')
    expect(params.get('limit')).toBe('30')
  })

  it('keeps repeated cityIds and neighborhoodIds', () => {
    const queryString = buildListingsApiQueryString({
      rawSearchParamsString: 'cityIds=a&cityIds=b&cityIds=a,b&neighborhoodIds=n1&neighborhoodIds=n2&neighborhoodIds=n2',
      preferences: {
        page: 1,
        limit: 20,
        priceBand: 'all',
        radius: '25'
      },
      defaultPageSize: 20,
      resolvePriceBand: () => undefined,
      attributeFilters: {}
    })

    const params = new URLSearchParams(queryString)
    expect(params.getAll('cityIds')).toEqual(['a', 'b'])
    expect(params.getAll('neighborhoodIds')).toEqual(['n1', 'n2'])
  })

  it('normalizes pagination and titleOnly contract keys', () => {
    const queryString = buildListingsApiQueryString({
      rawSearchParamsString: 'titleOnly=false&page=-1&limit=9999',
      preferences: {
        page: 2,
        limit: 200,
        priceBand: 'all',
        radius: '25'
      },
      defaultPageSize: 20,
      resolvePriceBand: () => undefined,
      attributeFilters: {}
    })

    const params = new URLSearchParams(queryString)
    expect(params.get('titleOnly')).toBeNull()
    expect(params.get('page')).toBe('2')
    expect(params.get('limit')).toBe('100')
  })

  it('drops invalid coordinates and avoids radius without coordinates', () => {
    const queryString = buildListingsApiQueryString({
      rawSearchParamsString: 'lat=120&lng=9.76&radiusKm=30',
      preferences: {
        page: 1,
        limit: 20,
        priceBand: 'all',
        radius: '50'
      },
      defaultPageSize: 20,
      resolvePriceBand: () => undefined,
      attributeFilters: {}
    })

    const params = new URLSearchParams(queryString)
    expect(params.get('lat')).toBeNull()
    expect(params.get('lng')).toBeNull()
    expect(params.get('radiusKm')).toBeNull()
  })

  it('injects defaults and price band values', () => {
    const queryString = buildListingsApiQueryString({
      rawSearchParamsString: 'lat=4.05&lng=9.76',
      preferences: {
        page: 3,
        limit: 40,
        priceBand: 'mid',
        radius: '25'
      },
      defaultPageSize: 20,
      resolvePriceBand: id => (id === 'mid' ? { min: 10000, max: 50000 } : undefined),
      attributeFilters: {}
    })

    const params = new URLSearchParams(queryString)
    expect(params.get('page')).toBe('3')
    expect(params.get('limit')).toBe('40')
    expect(params.get('radiusKm')).toBe('25')
    expect(params.get('minPrice')).toBe('10000')
    expect(params.get('maxPrice')).toBe('50000')
  })

  it('parses attribute filters from prefixed URL params', () => {
    const params = new URLSearchParams()
    params.append(`${ATTRIBUTE_PARAM_PREFIX}condition`, 'new')
    params.append(`${ATTRIBUTE_PARAM_PREFIX}brand`, 'Apple')

    expect(parseAttributeFiltersFromParams(params)).toEqual({
      condition: 'new',
      brand: 'Apple'
    })
  })

  it('normalizes attribute filters and removes empty values', () => {
    expect(
      normalizeAttributeFilters({
        brand: ['Samsung', '', 'Apple'],
        color: ' ',
        memory: '128'
      })
    ).toEqual({
      brand: ['Apple', 'Samsung'],
      memory: '128'
    })
  })

  it('parses incoming state from legacy keys', () => {
    const parsed = parseSearchUrlState(
      'q=coloc&l=Douala&llabel=Akwa%2C%20Douala&category=immobilier&radius=50&sort=priceAsc&adType=SELL&sellerType=pro&minPrice=100&maxPrice=200&lat=4.05&lng=9.76'
    )

    expect(parsed).toMatchObject({
      term: 'coloc',
      city: 'Douala',
      locationLabel: 'Akwa, Douala',
      categorySlug: 'immobilier',
      radiusQuery: '50',
      sortParam: 'priceAsc',
      adTypeParam: 'SELL',
      sellerTypeParam: 'pro',
      minPriceQuery: '100',
      maxPriceQuery: '200',
      hasLocationSelection: true
    })
  })

  it('parses incoming state from canonical keys', () => {
    const parsed = parseSearchUrlState(
      'search=coloc%20yaounde&city=Yaounde&categorySlug=services&radiusKm=25'
    )

    expect(parsed).toMatchObject({
      term: 'coloc yaounde',
      city: 'Yaounde',
      locationLabel: 'Yaounde',
      categorySlug: 'services',
      radiusQuery: '25',
      hasLocationSelection: false
    })
  })
})
