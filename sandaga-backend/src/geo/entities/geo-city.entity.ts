import { Column, Entity, Index, OneToMany } from 'typeorm';
import { CoreEntity } from '../../common/entities/base.entity';
import { GeoNeighborhood } from './geo-neighborhood.entity';

@Entity({ name: 'geo_cities' })
@Index(['normalizedName'])
@Index(['isPopular', 'isActive'])
export class GeoCity extends CoreEntity {
  @Column({ length: 120 })
  name!: string;

  @Column({ length: 140, unique: true })
  slug!: string;

  @Column({ name: 'normalized_name', length: 160 })
  normalizedName!: string;

  @Column({ length: 120, nullable: true })
  region?: string | null;

  @Column({ name: 'country_code', length: 8, default: 'CM' })
  countryCode!: string;

  @Column({ type: 'double precision' })
  lat!: number;

  @Column({ type: 'double precision' })
  lng!: number;

  @Column({ name: 'place_type', length: 32, default: 'city' })
  placeType!: string;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @Column({ name: 'is_popular', default: false })
  isPopular!: boolean;

  @Column({ type: 'int', nullable: true })
  population?: number | null;

  @OneToMany(() => GeoNeighborhood, neighborhood => neighborhood.city)
  neighborhoods!: GeoNeighborhood[];
}
