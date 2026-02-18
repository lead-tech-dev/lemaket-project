import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { DeliveriesService } from './deliveries.service';
import { CreateDeliveryDto } from './dto/create-delivery.dto';
import { UpdateDeliveryStatusDto } from './dto/update-delivery-status.dto';
import { CancelDeliveryDto } from './dto/cancel-delivery.dto';
import { InitDeliveryEscrowDto } from './dto/init-delivery-escrow.dto';
import { ConfirmPickupCodeDto } from './dto/confirm-pickup-code.dto';
import { ConfirmDeliveryCodeDto } from './dto/confirm-delivery-code.dto';

@Controller('deliveries')
@UseGuards(JwtAuthGuard)
export class DeliveriesController {
  constructor(private readonly deliveriesService: DeliveriesService) {}

  @Get('available')
  listAvailable(@CurrentUser() user: AuthUser) {
    return this.deliveriesService.listAvailable(user);
  }

  @Get('mine')
  listMine(@CurrentUser() user: AuthUser) {
    return this.deliveriesService.listMine(user);
  }

  @Get('listing/:listingId')
  getForListing(@Param('listingId') listingId: string, @CurrentUser() user: AuthUser) {
    return this.deliveriesService.getForListing(user, listingId);
  }

  @Post()
  create(@Body() dto: CreateDeliveryDto, @CurrentUser() user: AuthUser) {
    return this.deliveriesService.createDelivery(user, dto);
  }

  @Post('escrow/init')
  initEscrow(@Body() dto: InitDeliveryEscrowDto, @CurrentUser() user: AuthUser) {
    return this.deliveriesService.initDeliveryEscrow(user, dto);
  }

  @Post(':id/accept')
  accept(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.deliveriesService.acceptDelivery(id, user);
  }

  @Post(':id/escrow')
  requestEscrow(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.deliveriesService.requestEscrowPayment(user, id);
  }

  @Post(':id/escrow/release')
  releaseEscrow(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.deliveriesService.releaseEscrow(user, id);
  }

  @Get(':id/pickup/code')
  getPickupCode(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.deliveriesService.getPickupCode(id, user);
  }

  @Post(':id/pickup/confirm')
  confirmPickupCode(
    @Param('id') id: string,
    @Body() dto: ConfirmPickupCodeDto,
    @CurrentUser() user: AuthUser
  ) {
    return this.deliveriesService.confirmPickupCode(id, user, dto.code);
  }

  @Get(':id/delivery/code')
  getDeliveryCode(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.deliveriesService.getDeliveryCode(id, user);
  }

  @Post(':id/delivery/confirm')
  confirmDeliveryCode(
    @Param('id') id: string,
    @Body() dto: ConfirmDeliveryCodeDto,
    @CurrentUser() user: AuthUser
  ) {
    return this.deliveriesService.confirmDeliveryCode(id, user, dto.code);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateDeliveryStatusDto,
    @CurrentUser() user: AuthUser
  ) {
    return this.deliveriesService.updateStatus(id, user, dto);
  }

  @Post(':id/cancel')
  cancel(
    @Param('id') id: string,
    @Body() dto: CancelDeliveryDto,
    @CurrentUser() user: AuthUser
  ) {
    return this.deliveriesService.cancelDelivery(id, user, dto.reason);
  }
}
