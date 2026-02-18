import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Express } from 'express';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateTwoFactorDto } from './dto/update-two-factor.dto';
import { DeactivateAccountDto } from './dto/deactivate-account.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PaginationQueryDto } from '../common/dtos/pagination-query.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { AdminService } from '../admin/admin.service';
import { UpsertAddressDto } from './dto/upsert-address.dto';
import { UploadIdentityDocumentDto } from './dto/upload-identity-document.dto';
import { MediaService } from '../media/media.service';

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly adminService: AdminService,
    private readonly mediaService: MediaService
  ) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMe(@CurrentUser() user: AuthUser) {
    return this.usersService.findOne(user.id);
  }

  @Get('couriers')
  listCouriers(
    @Query('city') city?: string,
    @Query('zipcode') zipcode?: string,
    @Query('limit') limit?: string
  ) {
    return this.usersService.listCouriersNearby({
      city: city?.trim() || undefined,
      zipcode: zipcode?.trim() || undefined,
      limit: limit ? Number(limit) : undefined
    });
  }

  @Get('public/slug/:slug')
  @UseGuards(OptionalJwtAuthGuard)
  getPublicProfileBySlug(@Param('slug') slug: string) {
    return this.usersService.getPublicProfileBySlug(slug);
  }

  @Get('public/:id')
  @UseGuards(OptionalJwtAuthGuard)
  getPublicProfile(@Param('id') id: string) {
    return this.usersService.getPublicProfile(id);
  }

  @Get('me/follows')
  @UseGuards(JwtAuthGuard)
  listFollows(@CurrentUser() user: AuthUser) {
    return this.usersService.listFollowedSellerIds(user.id).then(sellerIds => ({
      sellerIds
    }));
  }

  @Get('me/follows/list')
  @UseGuards(JwtAuthGuard)
  listFollowedSellers(@CurrentUser() user: AuthUser) {
    return this.usersService.listFollowedSellers(user.id);
  }

  @Post(':id/follow')
  @UseGuards(JwtAuthGuard)
  followSeller(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.usersService.followSeller(user.id, id);
  }

  @Delete(':id/follow')
  @UseGuards(JwtAuthGuard)
  unfollowSeller(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.usersService.unfollowSeller(user.id, id);
  }

  @Get(':id/followers/count')
  getFollowersCount(@Param('id') id: string) {
    return this.usersService.getFollowersCount(id).then(count => ({ count }));
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  updateMe(
    @CurrentUser() user: AuthUser,
    @Body() updateProfileDto: UpdateProfileDto
  ) {
    return this.usersService.updateProfile(user.id, updateProfileDto);
  }

  @Patch('me/settings')
  @UseGuards(JwtAuthGuard)
  updateSettings(
    @CurrentUser() user: AuthUser,
    @Body() updateSettingsDto: UpdateSettingsDto
  ) {
    return this.usersService.updateSettings(user.id, updateSettingsDto);
  }

  @Patch('me/two-factor')
  @UseGuards(JwtAuthGuard)
  updateTwoFactor(
    @CurrentUser() user: AuthUser,
    @Body() updateTwoFactorDto: UpdateTwoFactorDto
  ) {
    return this.usersService.updateTwoFactor(user.id, updateTwoFactorDto.enable);
  }

  @Patch('me/change-password')
  @UseGuards(JwtAuthGuard)
  changePassword(
    @CurrentUser() user: AuthUser,
    @Body() changePasswordDto: ChangePasswordDto
  ) {
    return this.usersService.changePassword(user.id, changePasswordDto);
  }

  @Get('me/addresses')
  @UseGuards(JwtAuthGuard)
  listAddresses(@CurrentUser() user: AuthUser) {
    return this.usersService.listAddresses(user.id);
  }

  @Post('me/addresses')
  @UseGuards(JwtAuthGuard)
  createAddress(
    @CurrentUser() user: AuthUser,
    @Body() payload: UpsertAddressDto
  ) {
    return this.usersService.createAddress(user.id, payload);
  }

  @Patch('me/addresses/:id')
  @UseGuards(JwtAuthGuard)
  updateAddress(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() payload: UpsertAddressDto
  ) {
    return this.usersService.updateAddress(user.id, id, payload);
  }

  @Delete('me/addresses/:id')
  @UseGuards(JwtAuthGuard)
  removeAddress(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string
  ) {
    return this.usersService.deleteAddress(user.id, id);
  }

  @Post('me/identity-docs')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage()
    })
  )
  async uploadIdentityDocument(
    @CurrentUser() user: AuthUser,
    @Body() payload: UploadIdentityDocumentDto,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }),
          new FileTypeValidator({
            fileType: /(jpg|jpeg|png|pdf)$/i
          })
        ]
      })
    )
    file: Express.Multer.File
  ) {
    if (!file) {
      throw new BadRequestException('Aucun fichier reçu');
    }

    const uploadResult = await this.mediaService.uploadFile(file, { watermark: false });
    return this.usersService.addIdentityDocument(user.id, payload.type, {
      url: uploadResult.url,
      description: payload.description
    });
  }

  @Post('me/courier-doc')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage()
    })
  )
  async uploadCourierDocument(
    @CurrentUser() user: AuthUser,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }),
          new FileTypeValidator({
            fileType: /(jpg|jpeg|png|pdf)$/i
          })
        ]
      })
    )
    file: Express.Multer.File
  ) {
    if (!file) {
      throw new BadRequestException('Aucun fichier reçu');
    }

    const uploadResult = await this.mediaService.uploadFile(file, { watermark: false });
    return this.usersService.updateCourierVerificationDocument(user.id, uploadResult.url);
  }

  @Delete('me/identity-docs/:documentId')
  @UseGuards(JwtAuthGuard)
  removeIdentityDocument(
    @CurrentUser() user: AuthUser,
    @Param('documentId') documentId: string
  ) {
    return this.usersService.removeIdentityDocument(user.id, documentId);
  }

  @Post('me/company-doc')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage()
    })
  )
  async uploadCompanyDocument(
    @CurrentUser() user: AuthUser,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }),
          new FileTypeValidator({
            fileType: /(jpg|jpeg|png|pdf)$/i
          })
        ]
      })
    )
    file: Express.Multer.File
  ) {
    if (!file) {
      throw new BadRequestException('Aucun fichier reçu');
    }

    const uploadResult = await this.mediaService.uploadFile(file, { watermark: false });
    return this.usersService.updateCompanyVerificationDocument(user.id, uploadResult.url);
  }

  @Delete('me')
  @UseGuards(JwtAuthGuard)
  deactivateMe(
    @CurrentUser() user: AuthUser,
    @Body() deactivateAccountDto: DeactivateAccountDto
  ) {
    return this.usersService.deactivate(user.id, deactivateAccountDto.reason);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  findAll(@Query() paginationQuery: PaginationQueryDto) {
    return this.usersService.findAll(paginationQuery);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  async update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
    @CurrentUser() actor: AuthUser
  ) {
    const updated = await this.usersService.update(id, updateUserDto);
    await this.adminService.recordLog({
      action: 'users.update',
      actorName: actor.email,
      actorRole: actor.role,
      details: `Mise à jour du compte ${updated.email} (${id})`
    });
    return updated;
  }

  @Patch(':id/pro')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  async promoteToPro(
    @Param('id') id: string,
    @CurrentUser() actor: AuthUser
  ) {
    const updated = await this.usersService.setProStatus(id);
    await this.adminService.recordLog({
      action: 'users.promote',
      actorName: actor.email,
      actorRole: actor.role,
      details: `Promotion PRO pour ${updated.email} (${id})`
    });
    return updated;
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async remove(@Param('id') id: string, @CurrentUser() actor: AuthUser) {
    await this.usersService.remove(id);
    await this.adminService.recordLog({
      action: 'users.delete',
      actorName: actor.email,
      actorRole: actor.role,
      details: `Suppression du compte utilisateur ${id}`
    });
    return { success: true };
  }
}
