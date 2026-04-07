import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards
} from '@nestjs/common'
import { SearchLogsService } from './search-logs.service'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { RolesGuard } from '../common/guards/roles.guard'
import { Roles } from '../common/decorators/roles.decorator'
import { UserRole } from '../common/enums/user-role.enum'
import { UpsertSearchSynonymDto } from './dto/upsert-search-synonym.dto'

@Controller('search')
export class SearchLogsController {
  constructor(private readonly searchLogsService: SearchLogsService) {}

  @Get('suggestions')
  getSuggestions(
    @Query('q') q?: string,
    @Query('limit') limit?: string
  ) {
    return this.searchLogsService.getQuerySuggestions(
      q ?? '',
      this.parseLimit(limit)
    )
  }

  @Get('synonyms')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  listSearchSynonyms() {
    return this.searchLogsService.listSearchSynonyms()
  }

  @Post('synonyms')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  async upsertSearchSynonym(@Body() payload: UpsertSearchSynonymDto) {
    try {
      return await this.searchLogsService.upsertSearchSynonym(
        payload.term,
        payload.synonym,
        payload.isActive ?? true
      )
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Invalid synonym payload.'
      )
    }
  }

  @Delete('synonyms/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  async deleteSearchSynonym(@Param('id') id: string) {
    await this.searchLogsService.deleteSearchSynonym(id)
    return {
      success: true
    }
  }

  private parseLimit(value?: string): number | undefined {
    if (!value?.trim()) {
      return undefined
    }
    const parsed = Number.parseInt(value, 10)
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return undefined
    }
    return parsed
  }
}
