import {
  Body,
  Controller,
  Delete,
  FileTypeValidator,
  Get,
  MaxFileSizeValidator,
  Param,
  ParseEnumPipe,
  ParseFilePipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors
} from '@nestjs/common';
import { Req, Res } from '@nestjs/common';
import { ListingsService } from './listings.service';
import { CreateListingDto } from './dto/create-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { FilterListingsDto } from './dto/filter-listings.dto';
import { FormSchemaDTO } from './dto/form-schema.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { ListingStatus } from '../common/enums/listing-status.enum';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { FileInterceptor } from '@nestjs/platform-express';
import { MediaService } from '../media/media.service';
import { ListingResponseDTO } from './dto/listing-response.dto';
import { PriceSuggestionQueryDto } from './dto/price-suggestion-query.dto';

@Controller('listings')
export class ListingsController {
  constructor(private readonly listingsService: ListingsService, private readonly mediaService: MediaService) {}

  @Get()
  findAll(@Query() filterListingsDto: FilterListingsDto) {
    return this.listingsService.findAll(filterListingsDto);
  }

  @Get('form-schema/:categoryId')
  getFormSchema(@Param('categoryId') categoryId: string): Promise<FormSchemaDTO> {
    return this.listingsService.getFormSchema(categoryId) as Promise<FormSchemaDTO>;
  }

  @Get('price-suggestion')
  getPriceSuggestion(@Query() query: PriceSuggestionQueryDto) {
    return this.listingsService.getPriceSuggestion(query);
  }

  @Get('featured')
  getFeatured(@Query('limit') limit?: string) {
    const parsedLimit = limit ? Number(limit) : 4;
    return this.listingsService.getFeatured(parsedLimit);
  }

  @Get('latest')
  getLatest(@Query('limit') limit?: string) {
    const parsedLimit = limit ? Number(limit) : 10;
    return this.listingsService.getLatest(parsedLimit);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMine(@CurrentUser() user: AuthUser, @Query('status') status?: ListingStatus) {
    return this.listingsService.findMine(user.id, status);
  }

  @Get('pending')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  getPending() {
    return this.listingsService.findPending();
  }

  @Get(':id/similar')
  getSimilar(@Param('id') id: string, @Query('limit') limit?: string) {
    const parsedLimit = limit ? Number(limit) : 6;
    return this.listingsService.getSimilar(id, parsedLimit);
  }

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  findOne(
    @Param('id') id: string,
    @CurrentUser() user?: AuthUser
  ): Promise<ListingResponseDTO> {
    return this.listingsService.findOneDto(id, user);
  }

  @Get(':id/og')
  async getOgPage(@Param('id') id: string, @Req() req: any, @Res() res: any) {
    const listing = await this.listingsService.findPublicForOg(id);
    const host = req.get?.('host');
    const protocol = req.protocol ?? 'https';
    const absoluteUrl = host ? `${protocol}://${host}/listing/${id}` : `/listing/${id}`;
    const html = this.listingsService.buildOgHtml(listing, absoluteUrl);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(html);
  }

  @Get(':id/export')
  async exportPdf(@Param('id') id: string, @Res() res: any) {
    const pdfBuffer = await this.listingsService.exportPdf(id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="listing-${id}.pdf"`,
      'Content-Length': pdfBuffer.length
    });
    return res.send(pdfBuffer);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(
    @Body() createListingDto: CreateListingDto,
    @CurrentUser() user: AuthUser
  ) {
    return this.listingsService.create(createListingDto, user);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(
    @Param('id') id: string,
    @Body() updateListingDto: UpdateListingDto,
    @CurrentUser() user: AuthUser
  ) {
    return this.listingsService.update(id, updateListingDto, user);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.listingsService.remove(id, user);
  }

  @Post(':id/views')
  incrementViews(@Param('id') id: string) {
    return this.listingsService.incrementViews(id);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  updateStatus(
    @Param('id') id: string,
    @Body('status', new ParseEnumPipe(ListingStatus)) status: ListingStatus,
    @CurrentUser() user: AuthUser
  ) {
    return this.listingsService.updateStatus(id, status, user);
  }

  @Post(':id/images')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  async addImage(
    @Param('id') id: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 1024 * 1024 * 5 }),
          new FileTypeValidator({ fileType: 'image/jpeg' }),
        ],
      }),
    )
    file: Express.Multer.File,
    @CurrentUser() user: AuthUser,
  ) {
    const { url } = await this.mediaService.uploadFile(file);
    return this.listingsService.addImage(id, url, user);
  }

  @Delete(':id/images/:imageId')
  @UseGuards(JwtAuthGuard)
  async removeImage(
    @Param('id') id: string,
    @Param('imageId') imageId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.listingsService.removeImage(id, imageId, user);
  }
}
