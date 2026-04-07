import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { CoreEntity } from '../../common/entities/base.entity';
import { GeoCity } from './geo-city.entity';

@Entity({ name: 'geo_neighborhoods' })
@Index(['normalizedName'])
@Index(['cityId', 'normalizedName'])
export class GeoNeighborhood extends CoreEntity {
  @Column({ length: 120 })
  name!: string;

  @Column({ length: 140 })
  slug!: string;

  @Column({ name: 'normalized_name', length: 160 })
  normalizedName!: string;

  @Column({ name: 'city_id', type: 'uuid' })
  cityId!: string;

  @ManyToOne(() => GeoCity, city => city.neighborhoods, {
    nullable: false,
    onDelete: 'CASCADE'
  })
  @JoinColumn({ name: 'city_id' })
  city!: GeoCity;

  @Column({ type: 'double precision', nullable: true })
  lat?: number | null;

  @Column({ type: 'double precision', nullable: true })
  lng?: number | null;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;
}
