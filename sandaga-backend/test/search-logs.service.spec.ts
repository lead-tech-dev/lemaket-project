import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { SearchLog } from '../src/search-logs/search-log.entity'
import { SearchSynonym } from '../src/search-logs/search-synonym.entity'
import { SearchLogsService } from '../src/search-logs/search-logs.service'
import { SearchRelevanceSettingsService } from '../src/search-logs/search-relevance-settings.service'
import { MonitoringMetricsService } from '../src/monitoring/monitoring.metrics.service'

describe('SearchLogsService', () => {
  let service: SearchLogsService

  const repositoryMock = {
    create: jest.fn(),
    save: jest.fn(),
    query: jest.fn()
  }
  const synonymRepositoryMock = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    delete: jest.fn()
  }
  const relevanceSettingsServiceMock = {
    getSettings: jest.fn(),
    invalidateCache: jest.fn()
  }
  const monitoringMetricsServiceMock = {
    observeSearchSuggestionsCache: jest.fn(),
    observeSearchSuggestionsQuery: jest.fn()
  }

  beforeEach(async () => {
    jest.clearAllMocks()
    repositoryMock.query.mockResolvedValue([])
    synonymRepositoryMock.find.mockResolvedValue([])
    synonymRepositoryMock.findOne.mockResolvedValue(null)
    relevanceSettingsServiceMock.getSettings.mockResolvedValue({
      enableBusinessBoost: true,
      enableDynamicSynonyms: true,
      popularCityBoost: 28,
      proSellerBoost: 8,
      categoryPriorityWeights: {},
      categoryWeightsText: ''
    })
    monitoringMetricsServiceMock.observeSearchSuggestionsCache.mockReset()
    monitoringMetricsServiceMock.observeSearchSuggestionsQuery.mockReset()

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchLogsService,
        {
          provide: getRepositoryToken(SearchLog),
          useValue: repositoryMock
        },
        {
          provide: getRepositoryToken(SearchSynonym),
          useValue: synonymRepositoryMock
        },
        {
          provide: SearchRelevanceSettingsService,
          useValue: relevanceSettingsServiceMock
        },
        {
          provide: MonitoringMetricsService,
          useValue: monitoringMetricsServiceMock
        }
      ]
    }).compile()

    service = module.get<SearchLogsService>(SearchLogsService)
  })

  it('is defined', () => {
    expect(service).toBeDefined()
  })

  it('returns no suggestions when query is too short', async () => {
    const result = await service.getQuerySuggestions('a')

    expect(result).toEqual([])
    expect(repositoryMock.query).not.toHaveBeenCalled()
  })

  it('maps aggregated rows into suggestions and caps limit', async () => {
    repositoryMock.query.mockResolvedValue([
      {
        normalizedQuery: 'coloc douala',
        label: 'Coloc Douala',
        maxResultCount: '45',
        hits: '18'
      }
    ])

    const result = await service.getQuerySuggestions('coloc', 200)

    expect(result).toEqual([
      expect.objectContaining({
        label: 'Coloc Douala',
        query: 'coloc douala',
        resultCount: 45,
        hits: 18
      })
    ])
    expect(repositoryMock.query).toHaveBeenCalledWith(
      expect.stringContaining('LIMIT $4'),
      expect.arrayContaining([20])
    )
    expect(monitoringMetricsServiceMock.observeSearchSuggestionsCache).toHaveBeenCalledWith(false)
    expect(monitoringMetricsServiceMock.observeSearchSuggestionsQuery).toHaveBeenCalledWith(
      expect.any(Number),
      1
    )
  })

  it('normalizes accented input and strips noisy suggestions', async () => {
    repositoryMock.query.mockResolvedValue([
      {
        normalizedQuery: 'téléphone  ',
        label: '  téléphone   neuf ',
        maxResultCount: '5',
        hits: '2'
      },
      {
        normalizedQuery: '12345',
        label: '12345',
        maxResultCount: '10',
        hits: '4'
      }
    ])

    const result = await service.getQuerySuggestions('  Téléphône  ', 8)

    expect(repositoryMock.query).toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining(['telephone%', expect.any(String), '%telephone%', 8])
    )
    expect(result).toEqual([
      expect.objectContaining({
        query: 'telephone',
        label: 'Téléphone Neuf'
      })
    ])
  })

  it('deduplicates suggestions by canonical query key', async () => {
    repositoryMock.query.mockResolvedValue([
      {
        normalizedQuery: 'makepe bonamoussadi',
        label: 'Makepe Bonamoussadi',
        maxResultCount: '21',
        hits: '5'
      },
      {
        normalizedQuery: 'maképé-bonamoussadi',
        label: 'Maképé Bonamoussadi',
        maxResultCount: '19',
        hits: '4'
      }
    ])

    const result = await service.getQuerySuggestions('makepe', 10)

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual(
      expect.objectContaining({
        query: 'makepe bonamoussadi'
      })
    )
  })

  it('uses suggestions cache for identical normalized query', async () => {
    repositoryMock.query.mockResolvedValue([
      {
        normalizedQuery: 'coloc douala',
        label: 'Coloc Douala',
        maxResultCount: '10',
        hits: '3'
      }
    ])

    await service.getQuerySuggestions('coloc')
    await service.getQuerySuggestions('  coloc  ')

    expect(repositoryMock.query).toHaveBeenCalledTimes(1)
    expect(monitoringMetricsServiceMock.observeSearchSuggestionsCache).toHaveBeenNthCalledWith(1, false)
    expect(monitoringMetricsServiceMock.observeSearchSuggestionsCache).toHaveBeenNthCalledWith(2, true)
  })

  it('adds fuzzy alternatives when prefix suggestions only return the same query', async () => {
    repositoryMock.query
      .mockResolvedValueOnce([
        {
          normalizedQuery: 'telephne',
          label: 'Telephne',
          maxResultCount: '2',
          hits: '1'
        }
      ])
      .mockResolvedValueOnce([
        {
          normalizedQuery: 'telephone',
          label: 'Téléphone',
          maxResultCount: '40',
          hits: '18'
        },
        {
          normalizedQuery: 'television',
          label: 'Télévision',
          maxResultCount: '28',
          hits: '10'
        }
      ])

    const result = await service.getQuerySuggestions('telephne', 5)

    expect(repositoryMock.query).toHaveBeenCalledTimes(2)
    expect(result.map(item => item.query)).toContain('telephne')
    expect(result.map(item => item.query)).toContain('telephone')
  })

  it('falls back to fuzzy suggestions when prefix query returns nothing', async () => {
    repositoryMock.query
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          normalizedQuery: 'colocation',
          label: 'Colocation',
          maxResultCount: '31',
          hits: '14'
        },
        {
          normalizedQuery: 'collocation',
          label: 'Collocation',
          maxResultCount: '6',
          hits: '5'
        }
      ])

    const result = await service.getQuerySuggestions('colocatio', 5)

    expect(repositoryMock.query).toHaveBeenCalledTimes(2)
    expect(result.length).toBeGreaterThan(0)
    expect(result[0].query).toBe('colocation')
  })

  it('builds symmetric runtime synonym map and caches it', async () => {
    synonymRepositoryMock.find.mockResolvedValue([
      {
        id: '1',
        term: 'voiture',
        synonym: 'automobile',
        normalizedTerm: 'voiture',
        normalizedSynonym: 'automobile',
        isActive: true
      }
    ])

    const first = await service.getSearchSynonymsMap()
    const second = await service.getSearchSynonymsMap()

    expect(first.voiture).toEqual(expect.arrayContaining(['automobile']))
    expect(first.automobile).toEqual(expect.arrayContaining(['voiture']))
    expect(second).toEqual(first)
    expect(synonymRepositoryMock.find).toHaveBeenCalledTimes(1)
  })

  it('returns empty runtime synonym map when dynamic synonyms are disabled', async () => {
    relevanceSettingsServiceMock.getSettings.mockResolvedValue({
      enableBusinessBoost: true,
      enableDynamicSynonyms: false,
      popularCityBoost: 28,
      proSellerBoost: 8,
      categoryPriorityWeights: {},
      categoryWeightsText: ''
    })

    const result = await service.getSearchSynonymsMap()

    expect(result).toEqual({})
    expect(synonymRepositoryMock.find).not.toHaveBeenCalled()
  })

  it('upserts synonym entries and invalidates cache', async () => {
    synonymRepositoryMock.find.mockResolvedValue([
      {
        id: '1',
        term: 'voiture',
        synonym: 'automobile',
        normalizedTerm: 'voiture',
        normalizedSynonym: 'automobile',
        isActive: true
      }
    ])
    synonymRepositoryMock.create.mockImplementation((payload: any) => payload)
    synonymRepositoryMock.save.mockImplementation(async (payload: any) => ({
      id: payload.id ?? 'new-id',
      ...payload
    }))

    await service.getSearchSynonymsMap()
    await service.upsertSearchSynonym('Téléphone', 'GSM', true)
    await service.getSearchSynonymsMap()

    expect(synonymRepositoryMock.save).toHaveBeenCalled()
    expect(synonymRepositoryMock.find).toHaveBeenCalledTimes(2)
  })
})
