import { Controller, Get, Query } from '@nestjs/common';
import { GeoService } from './geo.service';
import { GeoNearbyQueryDto, GeoSearchQueryDto } from './dto/geo-query.dto';

@Controller('geo')
export class GeoController {
  constructor(private readonly geoService: GeoService) {}

  @Get('cities')
  async searchCities(@Query() query: GeoSearchQueryDto) {
    const cities = await this.geoService.searchCities(query.q, query.limit ?? 20);
    return cities.map(city => ({
      id: city.id,
      name: city.name,
      slug: city.slug,
      region: city.region ?? null,
      countryCode: city.countryCode,
      isPopular: city.isPopular,
      coordinates: [city.lng, city.lat] as [number, number]
    }));
  }

  @Get('neighborhoods')
  async searchNeighborhoods(@Query() query: GeoSearchQueryDto) {
    const neighborhoods = await this.geoService.searchNeighborhoods(
      query.q,
      query.cityId,
      query.limit ?? 20
    );
    return neighborhoods.map(item => ({
      id: item.id,
      name: item.name,
      slug: item.slug,
      cityId: item.cityId,
      city: item.city?.name ?? null,
      region: item.city?.region ?? null,
      coordinates:
        typeof item.lng === 'number' && typeof item.lat === 'number'
          ? ([item.lng, item.lat] as [number, number])
          : null
    }));
  }

  @Get('autocomplete')
  async autocomplete(@Query() query: GeoSearchQueryDto) {
    const q = query.q?.trim() ?? '';
    if (!q) {
      return [];
    }
    return this.geoService.autocomplete(q, query.limit ?? 8);
  }

  @Get('reverse')
  async reverse(@Query() query: GeoNearbyQueryDto) {
    const result = await this.geoService.reverseLookup(query.lat, query.lng);
    if (!result) {
      return null;
    }
    return {
      ...result,
      address: result.label
    };
  }

  @Get('nearby')
  async nearby(@Query() query: GeoNearbyQueryDto) {
    return this.geoService.nearby(
      query.lat,
      query.lng,
      query.radiusKm ?? 10,
      query.limit ?? 30
    );
  }
}
