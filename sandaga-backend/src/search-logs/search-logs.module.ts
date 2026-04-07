import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { SearchLog } from './search-log.entity'
import { SearchSynonym } from './search-synonym.entity'
import { AdminSetting } from '../admin/admin-setting.entity'
import { SearchLogsService } from './search-logs.service'
import { SearchLogsController } from './search-logs.controller'
import { SearchRelevanceSettingsService } from './search-relevance-settings.service'

@Module({
  imports: [TypeOrmModule.forFeature([SearchLog, SearchSynonym, AdminSetting])],
  controllers: [SearchLogsController],
  providers: [SearchLogsService, SearchRelevanceSettingsService],
  exports: [SearchLogsService, SearchRelevanceSettingsService]
})
export class SearchLogsModule {}
