import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { BadRequestException } from '@nestjs/common';
import { FilterListingsDto } from '../src/listings/dto/filter-listings.dto';

describe('FilterListingsDto', () => {
  it('accepts canonical valid filters', async () => {
    const dto = plainToInstance(FilterListingsDto, {
      search: 'coloc douala',
      categorySlug: 'immobilier',
      minPrice: '10000',
      maxPrice: '50000',
      cityIds: '11111111-1111-4111-8111-111111111111,22222222-2222-4222-8222-222222222222',
      neighborhoodIds: ['33333333-3333-4333-8333-333333333333'],
      lat: '4.05',
      lng: '9.76',
      radiusKm: '25',
      page: '2',
      limit: '20',
      attributes: JSON.stringify({ condition: 'new', brand: 'Apple' })
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.limit).toBe(20);
    expect(dto.page).toBe(2);
    expect(dto.attributes).toEqual({ condition: 'new', brand: 'Apple' });
  });

  it('rejects limit > 100', async () => {
    const dto = plainToInstance(FilterListingsDto, {
      limit: '101'
    });
    const errors = await validate(dto);
    expect(errors.some(error => error.property === 'limit')).toBe(true);
  });

  it('rejects invalid geo ranges', async () => {
    const dto = plainToInstance(FilterListingsDto, {
      lat: '120',
      lng: '-200'
    });
    const errors = await validate(dto);
    expect(errors.some(error => error.property === 'lat')).toBe(true);
    expect(errors.some(error => error.property === 'lng')).toBe(true);
  });

  it('throws explicit 400 for malformed attributes JSON', () => {
    expect(() =>
      plainToInstance(FilterListingsDto, {
        attributes: '{"invalid":'
      })
    ).toThrow(BadRequestException);
  });

  it('throws explicit 400 for non-object attributes JSON', () => {
    expect(() =>
      plainToInstance(FilterListingsDto, {
        attributes: '["x"]'
      })
    ).toThrow(BadRequestException);
  });
});
