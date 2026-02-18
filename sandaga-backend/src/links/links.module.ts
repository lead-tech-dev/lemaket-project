import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ShortLink } from './short-link.entity'
import { LinksService } from './links.service'
import { LinksController, ShortRedirectController } from './links.controller'

@Module({
  imports: [TypeOrmModule.forFeature([ShortLink])],
  providers: [LinksService],
  controllers: [LinksController, ShortRedirectController],
  exports: [LinksService]
})
export class LinksModule {}
