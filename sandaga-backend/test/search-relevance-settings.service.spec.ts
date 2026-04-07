import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { AdminSetting } from '../src/admin/admin-setting.entity'
import { SearchRelevanceSettingsService } from '../src/search-logs/search-relevance-settings.service'

describe('SearchRelevanceSettingsService', () => {
  let service: SearchRelevanceSettingsService
  let storedSettings: { key: string; value: Record<string, unknown> }[]

  const settingsRepositoryMock = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn()
  }

  beforeEach(async () => {
    jest.clearAllMocks()
    storedSettings = []
    settingsRepositoryMock.find.mockImplementation(async (options?: { where?: { key?: any } }) => {
      const rawKeyFilter = options?.where?.key
      const keys = Array.isArray(rawKeyFilter)
        ? rawKeyFilter
        : Array.isArray(rawKeyFilter?._value)
          ? rawKeyFilter._value
          : Array.isArray(rawKeyFilter?.value)
            ? rawKeyFilter.value
            : null

      if (!keys) {
        return storedSettings
      }
      return storedSettings.filter(setting => keys.includes(setting.key))
    })
    settingsRepositoryMock.findOne.mockImplementation(async (options: { where: { key: string } }) => {
      return storedSettings.find(setting => setting.key === options.where.key) ?? null
    })
    settingsRepositoryMock.create.mockImplementation((payload: any) => payload)
    settingsRepositoryMock.save.mockImplementation(async (payload: any) => {
      const index = storedSettings.findIndex(setting => setting.key === payload.key)
      if (index >= 0) {
        storedSettings[index] = payload
      } else {
        storedSettings.push(payload)
      }
      return payload
    })

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchRelevanceSettingsService,
        {
          provide: getRepositoryToken(AdminSetting),
          useValue: settingsRepositoryMock
        }
      ]
    }).compile()

    service = module.get<SearchRelevanceSettingsService>(SearchRelevanceSettingsService)
  })

  it('returns defaults when no admin setting is stored', async () => {
    const settings = await service.getSettings()

    expect(settings.enableBusinessBoost).toBe(true)
    expect(settings.enableDynamicSynonyms).toBe(true)
    expect(settings.popularCityBoost).toBe(28)
    expect(settings.proSellerBoost).toBe(8)
    expect(settings.categoryPriorityWeights.immobilier).toBe(26)
  })

  it('parses stored settings and normalizes category weights', async () => {
    storedSettings = [
      { key: 'search.relevance.enableBusinessBoost', value: { value: false } },
      { key: 'search.relevance.enableDynamicSynonyms', value: { value: false } },
      { key: 'search.relevance.popularCityBoost', value: { value: 33 } },
      { key: 'search.relevance.proSellerBoost', value: { value: 17 } },
      { key: 'search.relevance.categoryWeights', value: { value: 'Immobilier:40, Véhicules:31, foo:abc' } }
    ]

    const settings = await service.getSettings(true)

    expect(settings.enableBusinessBoost).toBe(false)
    expect(settings.enableDynamicSynonyms).toBe(false)
    expect(settings.popularCityBoost).toBe(33)
    expect(settings.proSellerBoost).toBe(17)
    expect(settings.categoryPriorityWeights.immobilier).toBe(40)
    expect(settings.categoryPriorityWeights.vehicules).toBe(31)
  })

  it('updates settings and invalidates cache', async () => {
    await service.getSettings()
    await service.updateSettings({
      enableBusinessBoost: false,
      proSellerBoost: 15,
      categoryWeightsText: 'services:18, emploi:21'
    })
    const settings = await service.getSettings(true)

    expect(settingsRepositoryMock.save).toHaveBeenCalled()
    expect(settings.enableBusinessBoost).toBe(false)
    expect(settings.proSellerBoost).toBe(15)
    expect(settings.categoryPriorityWeights.services).toBe(18)
    expect(settings.categoryPriorityWeights.emploi).toBe(21)
  })
})
