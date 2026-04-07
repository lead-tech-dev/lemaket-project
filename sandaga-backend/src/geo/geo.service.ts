import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GeoCity } from './entities/geo-city.entity';
import { GeoNeighborhood } from './entities/geo-neighborhood.entity';

type GeoSuggestion = {
  id: string;
  kind: 'city' | 'neighborhood';
  label: string;
  context: string | null;
  cityId?: string;
  city?: string | null;
  neighborhoodId?: string;
  zipcode?: string | null;
  coordinates: [number, number] | null;
};

const CITY_PLACE_TYPES = ['city', 'town', 'municipality', 'borough'];
const POPULAR_CITY_NEARBY_RADIUS_KM = 35;
const GEO_SIMILARITY_THRESHOLD = 0.34;

@Injectable()
export class GeoService {
  constructor(
    @InjectRepository(GeoCity)
    private readonly cityRepository: Repository<GeoCity>,
    @InjectRepository(GeoNeighborhood)
    private readonly neighborhoodRepository: Repository<GeoNeighborhood>
  ) {}

  private normalize(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ');
  }

  private async runSimilarityQuery<T>(
    primary: () => Promise<T>,
    fallback: () => Promise<T>
  ): Promise<T> {
    try {
      return await primary();
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (message.includes('lemaket_similarity') || message.includes('function similarity(')) {
        return fallback();
      }
      throw error;
    }
  }

  private computeSuggestionScore(suggestion: GeoSuggestion, normalizedQuery: string): number {
    const labelNormalized = this.normalize(suggestion.label ?? '');
    const cityNormalized = this.normalize(suggestion.city ?? suggestion.context ?? '');

    let score = 0;
    if (labelNormalized === normalizedQuery) score += 1200;
    if (labelNormalized.startsWith(normalizedQuery)) score += 800;
    if (labelNormalized.includes(` ${normalizedQuery}`)) score += 500;
    if (labelNormalized.includes(normalizedQuery)) score += 350;
    if (cityNormalized === normalizedQuery) score += 220;
    if (cityNormalized.startsWith(normalizedQuery)) score += 120;
    if (suggestion.kind === 'neighborhood') score += 30;
    return score;
  }

  private distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const toRad = (v: number) => (v * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return 6371 * c;
  }

  private async getPopularCities(limit = 20): Promise<GeoCity[]> {
    return this.cityRepository
      .createQueryBuilder('city')
      .where('city.isActive = :isActive', { isActive: true })
      .andWhere('city.isPopular = :isPopular', { isPopular: true })
      .andWhere('city.placeType IN (:...cityTypes)', { cityTypes: CITY_PLACE_TYPES })
      .orderBy('city.name', 'ASC')
      .take(limit)
      .getMany();
  }

  async getCityOrFail(id: string): Promise<GeoCity> {
    const city = await this.cityRepository.findOne({ where: { id, isActive: true } });
    if (!city) {
      throw new NotFoundException('Ville introuvable.');
    }
    return city;
  }

  async getNeighborhoodOrFail(id: string): Promise<GeoNeighborhood> {
    const neighborhood = await this.neighborhoodRepository.findOne({
      where: { id, isActive: true },
      relations: ['city']
    });
    if (!neighborhood) {
      throw new NotFoundException('Quartier introuvable.');
    }
    return neighborhood;
  }

  async resolveSelection(
    cityId?: string,
    neighborhoodId?: string
  ): Promise<{ cityId?: string; neighborhoodId?: string }> {
    let resolvedCityId = cityId;
    let resolvedNeighborhoodId = neighborhoodId;

    if (resolvedNeighborhoodId) {
      const neighborhood = await this.getNeighborhoodOrFail(resolvedNeighborhoodId);
      if (resolvedCityId && neighborhood.cityId !== resolvedCityId) {
        throw new BadRequestException('Le quartier sélectionné ne correspond pas à la ville.');
      }
      resolvedCityId = neighborhood.cityId;
    }

    if (resolvedCityId) {
      await this.getCityOrFail(resolvedCityId);
    }

    return {
      cityId: resolvedCityId,
      neighborhoodId: resolvedNeighborhoodId
    };
  }

  async searchCities(q?: string, limit = 20): Promise<GeoCity[]> {
    const safeLimit = Math.max(1, Math.min(limit, 50));
    const rawQuery = q?.trim();

    const buildQuery = (includeSimilarity: boolean) => {
      const queryBuilder = this.cityRepository
        .createQueryBuilder('city')
        .where('city.isActive = :isActive', { isActive: true })
        .andWhere('city.placeType IN (:...cityTypes)', { cityTypes: CITY_PLACE_TYPES })
        .andWhere("city.normalizedName !~ '^[0-9]+$'");

      if (rawQuery) {
        const normalized = this.normalize(rawQuery);
        queryBuilder.andWhere(
          `(
            city.normalizedName = :exact
            OR city.normalizedName LIKE :prefix
            OR city.normalizedName LIKE :wordPrefix
            OR city.normalizedName LIKE :contains
            ${includeSimilarity ? 'OR lemaket_similarity(city.normalizedName, :normalized) >= :similarityThreshold' : ''}
            OR city.name ILIKE :rawContains
          )`,
          {
            exact: normalized,
            prefix: `${normalized}%`,
            wordPrefix: `% ${normalized}%`,
            contains: `%${normalized}%`,
            normalized,
            similarityThreshold: GEO_SIMILARITY_THRESHOLD,
            rawContains: `%${rawQuery}%`
          }
        );
        queryBuilder.addSelect(
          `CASE
            WHEN city.normalizedName = :exact THEN 0
            WHEN city.normalizedName LIKE :prefix THEN 1
            WHEN city.normalizedName LIKE :wordPrefix THEN 2
            WHEN city.normalizedName LIKE :contains THEN 3
            ELSE 4
          END`,
          'city_search_match_rank'
        );
        queryBuilder.orderBy('city_search_match_rank', 'ASC');
        if (includeSimilarity) {
          queryBuilder.addSelect(
            `lemaket_similarity(city.normalizedName, :normalized)`,
            'city_search_similarity_rank'
          );
          queryBuilder.addOrderBy('city_search_similarity_rank', 'DESC');
        }
        queryBuilder.addOrderBy('city.isPopular', 'DESC');
        queryBuilder.addOrderBy('LENGTH(city.normalizedName)', 'ASC');
        queryBuilder.addOrderBy('city.name', 'ASC');
      } else {
        queryBuilder.orderBy('city.isPopular', 'DESC');
        queryBuilder.addOrderBy('city.name', 'ASC');
      }

      return queryBuilder.take(safeLimit);
    };

    if (!rawQuery) {
      return buildQuery(false).getMany();
    }

    return this.runSimilarityQuery(
      () => buildQuery(true).getMany(),
      () => buildQuery(false).getMany()
    );
  }

  async searchNeighborhoods(
    q?: string,
    cityId?: string,
    limit = 20
  ): Promise<GeoNeighborhood[]> {
    const safeLimit = Math.max(1, Math.min(limit, 50));
    const rawQuery = q?.trim();

    const buildQuery = (includeSimilarity: boolean) => {
      const queryBuilder = this.neighborhoodRepository
        .createQueryBuilder('neighborhood')
        .leftJoinAndSelect('neighborhood.city', 'city')
        .where('neighborhood.isActive = :isActive', { isActive: true })
        .andWhere('city.isActive = :cityIsActive', { cityIsActive: true });

      if (cityId) {
        queryBuilder.andWhere('neighborhood.cityId = :cityId', { cityId });
      }

      if (rawQuery) {
        const normalized = this.normalize(rawQuery);
        queryBuilder.andWhere(
          `(
            neighborhood.normalizedName = :exact
            OR neighborhood.normalizedName LIKE :prefix
            OR neighborhood.normalizedName LIKE :wordPrefix
            OR neighborhood.normalizedName LIKE :contains
            ${includeSimilarity ? 'OR lemaket_similarity(neighborhood.normalizedName, :normalized) >= :similarityThreshold' : ''}
            OR neighborhood.name ILIKE :rawContains
          )`,
          {
            exact: normalized,
            prefix: `${normalized}%`,
            wordPrefix: `% ${normalized}%`,
            contains: `%${normalized}%`,
            normalized,
            similarityThreshold: GEO_SIMILARITY_THRESHOLD,
            rawContains: `%${rawQuery}%`
          }
        );
        queryBuilder.addSelect(
          `CASE
            WHEN neighborhood.normalizedName = :exact THEN 0
            WHEN neighborhood.normalizedName LIKE :prefix THEN 1
            WHEN neighborhood.normalizedName LIKE :wordPrefix THEN 2
            WHEN neighborhood.normalizedName LIKE :contains THEN 3
            ELSE 4
          END`,
          'neighborhood_search_match_rank'
        );
        queryBuilder.orderBy('neighborhood_search_match_rank', 'ASC');
        if (includeSimilarity) {
          queryBuilder.addSelect(
            `lemaket_similarity(neighborhood.normalizedName, :normalized)`,
            'neighborhood_search_similarity_rank'
          );
          queryBuilder.addOrderBy('neighborhood_search_similarity_rank', 'DESC');
        }
      } else {
        queryBuilder.orderBy('city.isPopular', 'DESC');
      }

      queryBuilder.addOrderBy('city.isPopular', 'DESC');
      queryBuilder.addOrderBy('city.name', 'ASC');
      queryBuilder.addOrderBy('neighborhood.name', 'ASC');
      return queryBuilder.take(safeLimit);
    };

    if (!rawQuery) {
      return buildQuery(false).getMany();
    }

    return this.runSimilarityQuery(
      () => buildQuery(true).getMany(),
      () => buildQuery(false).getMany()
    );
  }

  private async searchNeighborhoodsForCities(
    cityIds: string[],
    limit: number
  ): Promise<GeoNeighborhood[]> {
    if (!cityIds.length) {
      return [];
    }

    const safeLimit = Math.max(1, Math.min(limit, 50));
    const query = this.neighborhoodRepository
      .createQueryBuilder('neighborhood')
      .leftJoinAndSelect('neighborhood.city', 'city')
      .where('neighborhood.isActive = :isActive', { isActive: true })
      .andWhere('city.isActive = :cityIsActive', { cityIsActive: true })
      .andWhere('neighborhood.cityId IN (:...cityIds)', { cityIds })
      .andWhere("neighborhood.normalizedName !~ '^[0-9]+$'")
      .andWhere('neighborhood.lat IS NOT NULL')
      .andWhere('neighborhood.lng IS NOT NULL')
      .orderBy('city.isPopular', 'DESC')
      .addOrderBy('city.name', 'ASC')
      .addOrderBy('neighborhood.name', 'ASC')
      .take(safeLimit);

    return query.getMany();
  }

  async autocomplete(q: string, limit = 8): Promise<GeoSuggestion[]> {
    const rawQuery = q.trim();
    if (rawQuery.length < 2) {
      return [];
    }

    const safeLimit = Math.max(1, Math.min(limit, 20));
    const normalizedQuery = this.normalize(rawQuery);
    const [neighborhoodsByName, cities, popularCities] = await Promise.all([
      this.searchNeighborhoods(rawQuery, undefined, safeLimit),
      this.searchCities(rawQuery, safeLimit),
      this.getPopularCities(20)
    ]);
    const cityIds = cities.map(city => city.id);
    const neighborhoodsByCity = await this.searchNeighborhoodsForCities(cityIds, safeLimit);
    const neighborhoods = [...neighborhoodsByName, ...neighborhoodsByCity];

    const neighborhoodSuggestions: GeoSuggestion[] = neighborhoods
      .map(item => {
        let mappedCity = item.city;
        let mappedCityId = item.cityId;
        let mappedNeighborhoodId: string | undefined = item.id;
        let mappedByPopularCity = false;

        if (typeof item.lat === 'number' && typeof item.lng === 'number' && popularCities.length) {
          let nearest: GeoCity | null = null;
          let nearestDistance = Number.POSITIVE_INFINITY;
          for (const city of popularCities) {
            const d = this.distanceKm(item.lat, item.lng, city.lat, city.lng);
            if (d < nearestDistance) {
              nearestDistance = d;
              nearest = city;
            }
          }
          if (nearest && nearestDistance <= POPULAR_CITY_NEARBY_RADIUS_KM) {
            mappedByPopularCity = true;
            mappedCity = nearest as any;
            mappedCityId = nearest.id;
            if (nearest.id !== item.cityId) {
              // Avoid city/neighborhood mismatch on resolveSelection.
              mappedNeighborhoodId = undefined;
            }
          }
        }

        return {
          id: `neighborhood:${item.id}`,
          kind: 'neighborhood' as const,
          label: `${item.name}, ${mappedCity.name}`,
          context: mappedCity.region ? `${mappedCity.name} · ${mappedCity.region}` : mappedCity.name,
          cityId: mappedCityId,
          city: mappedCity.name,
          neighborhoodId: mappedNeighborhoodId,
          zipcode: null,
          coordinates:
            typeof item.lng === 'number' && typeof item.lat === 'number'
              ? ([item.lng, item.lat] as [number, number])
              : null,
          mappedByPopularCity
        };
      })
      .sort((a, b) => {
        if (a.mappedByPopularCity !== b.mappedByPopularCity) {
          return a.mappedByPopularCity ? -1 : 1;
        }
        return a.label.localeCompare(b.label);
      })
      .map(({ mappedByPopularCity: _mapped, ...entry }) => entry);

    const citySuggestions: GeoSuggestion[] = cities.map(item => ({
      id: `city:${item.id}`,
      kind: 'city',
      label: item.region ? `${item.name}, ${item.region}` : item.name,
      context: item.region ?? null,
      cityId: item.id,
      city: item.name,
      neighborhoodId: undefined,
      zipcode: null,
      coordinates: [item.lng, item.lat]
    }));

    const merged = [...neighborhoodSuggestions, ...citySuggestions];
    const dedup = new Map<string, GeoSuggestion>();
    merged.forEach(entry => {
      const key = `${entry.kind}:${entry.cityId ?? ''}:${entry.neighborhoodId ?? entry.id}`;
      if (!dedup.has(key)) {
        dedup.set(key, entry);
      }
    });

    const ranked = Array.from(dedup.values())
      .map(entry => ({
        entry,
        score: this.computeSuggestionScore(entry, normalizedQuery)
      }))
      .sort((a, b) => {
        if (a.score !== b.score) {
          return b.score - a.score;
        }
        if (a.entry.kind !== b.entry.kind) {
          return a.entry.kind === 'neighborhood' ? -1 : 1;
        }
        return a.entry.label.localeCompare(b.entry.label);
      })
      .map(item => item.entry);

    return ranked.slice(0, safeLimit);
  }

  async reverseLookup(lat: number, lng: number): Promise<GeoSuggestion | null> {
    const nearestNeighborhood = await this.neighborhoodRepository
      .createQueryBuilder('neighborhood')
      .leftJoinAndSelect('neighborhood.city', 'city')
      .where('neighborhood.isActive = :isActive', { isActive: true })
      .andWhere('city.isActive = :cityIsActive', { cityIsActive: true })
      .andWhere('neighborhood.lat IS NOT NULL')
      .andWhere('neighborhood.lng IS NOT NULL')
      .orderBy(
        `(POWER(neighborhood.lat - :lat, 2) + POWER(neighborhood.lng - :lng, 2))`,
        'ASC'
      )
      .setParameters({ lat, lng })
      .take(1)
      .getOne();

    if (nearestNeighborhood) {
      return {
        id: `neighborhood:${nearestNeighborhood.id}`,
        kind: 'neighborhood',
        label: `${nearestNeighborhood.name}, ${nearestNeighborhood.city.name}`,
        context: nearestNeighborhood.city.region
          ? `${nearestNeighborhood.city.name} · ${nearestNeighborhood.city.region}`
          : nearestNeighborhood.city.name,
        cityId: nearestNeighborhood.cityId,
        city: nearestNeighborhood.city.name,
        neighborhoodId: nearestNeighborhood.id,
        zipcode: null,
        coordinates:
          typeof nearestNeighborhood.lng === 'number' &&
          typeof nearestNeighborhood.lat === 'number'
            ? [nearestNeighborhood.lng, nearestNeighborhood.lat]
            : null
      };
    }

    const nearestCity = await this.cityRepository
      .createQueryBuilder('city')
      .where('city.isActive = :isActive', { isActive: true })
      .orderBy('(POWER(city.lat - :lat, 2) + POWER(city.lng - :lng, 2))', 'ASC')
      .setParameters({ lat, lng })
      .take(1)
      .getOne();

    if (!nearestCity) {
      return null;
    }

    return {
      id: `city:${nearestCity.id}`,
      kind: 'city',
      label: nearestCity.region ? `${nearestCity.name}, ${nearestCity.region}` : nearestCity.name,
      context: nearestCity.region ?? null,
      cityId: nearestCity.id,
      city: nearestCity.name,
      neighborhoodId: undefined,
      zipcode: null,
      coordinates: [nearestCity.lng, nearestCity.lat]
    };
  }

  async nearby(lat: number, lng: number, radiusKm = 10, limit = 30) {
    const safeLimit = Math.max(1, Math.min(limit, 100));
    const safeRadius = Math.max(0.1, Math.min(radiusKm, 300));
    const radiusCondition = `(
      111.045 * DEGREES(
        ACOS(
          LEAST(
            1.0,
            COS(RADIANS(:lat)) * COS(RADIANS(city.lat))
            * COS(RADIANS(city.lng) - RADIANS(:lng))
            + SIN(RADIANS(:lat)) * SIN(RADIANS(city.lat))
          )
        )
      )
    ) <= :radiusKm`;

    const cities = await this.cityRepository
      .createQueryBuilder('city')
      .where('city.isActive = :isActive', { isActive: true })
      .andWhere('city.placeType IN (:...cityTypes)', { cityTypes: CITY_PLACE_TYPES })
      .andWhere(radiusCondition, { lat, lng, radiusKm: safeRadius })
      .orderBy('city.isPopular', 'DESC')
      .addOrderBy('city.name', 'ASC')
      .take(safeLimit)
      .getMany();

    return cities.map(city => ({
      id: city.id,
      name: city.name,
      slug: city.slug,
      region: city.region ?? null,
      coordinates: [city.lng, city.lat] as [number, number]
    }));
  }
}
