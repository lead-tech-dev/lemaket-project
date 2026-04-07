import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GeoCity } from './entities/geo-city.entity';
import { GeoNeighborhood } from './entities/geo-neighborhood.entity';
import { GeoController } from './geo.controller';
import { GeoService } from './geo.service';

@Module({
  imports: [TypeOrmModule.forFeature([GeoCity, GeoNeighborhood])],
  controllers: [GeoController],
  providers: [GeoService],
  exports: [GeoService]
})
export class GeoModule {}
