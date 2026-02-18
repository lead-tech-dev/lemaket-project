
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  Res
} from '@nestjs/common';
import type { Response } from 'express';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ProGuard } from '../common/guards/pro.guard';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { CreatePaymentMethodDto } from './dto/create-payment-method.dto';
import { UpdatePaymentMethodDto } from './dto/update-payment-method.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { ConfirmPaymentMethodDto } from './dto/confirm-payment-method.dto';
import { RequestProPlanDto } from './dto/request-pro-plan.dto';
import { MtnInitDto } from './dto/mtn-init.dto';
import { OrangeInitDto } from './dto/orange-init.dto';
import { WalletTopupDto } from './dto/wallet-topup.dto';
import { WalletWithdrawDto } from './dto/wallet-withdraw.dto';

@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get('options')
  @UseGuards(ProGuard)
  getPromotionOptions(@Query('category') category?: string) {
    return this.paymentsService.getPromotionOptions(category);
  }

  @Get('methods')
  getMethods(@CurrentUser() user: AuthUser) {
    return this.paymentsService.getMethods(user);
  }

  @Post('methods')
  addMethod(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreatePaymentMethodDto
  ) {
    return this.paymentsService.addMethod(user, dto);
  }

  @Patch('methods/:id')
  updateMethod(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdatePaymentMethodDto
  ) {
    return this.paymentsService.updateMethod(id, user, dto);
  }

  @Delete('methods/:id')
  removeMethod(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.paymentsService.removeMethod(id, user);
  }

  @Post('methods/:id/verify')
  beginVerification(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.paymentsService.beginVerification(id, user);
  }

  @Post('methods/:id/confirm')
  confirmVerification(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: ConfirmPaymentMethodDto
  ) {
    return this.paymentsService.confirmVerification(id, user, dto.success);
  }

  @Get('invoices')
  getPayments(@CurrentUser() user: AuthUser) {
    return this.paymentsService.getPayments(user);
  }

  @Get('invoices/:id')
  getInvoice(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.paymentsService.getInvoice(user, id);
  }

  @Post('checkout')
  @UseGuards(ProGuard)
  createPayment(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreatePaymentDto
  ) {
    return this.paymentsService.createPayment(user, dto);
  }

  @Post('mtn/init')
  initMtn(
    @CurrentUser() user: AuthUser,
    @Body() dto: MtnInitDto
  ) {
    return this.paymentsService.initMtn(user, dto);
  }

  @Post('orange/init')
  initOrange(
    @CurrentUser() user: AuthUser,
    @Body() dto: OrangeInitDto
  ) {
    return this.paymentsService.initOrange(user, dto);
  }

  @Get('checkout/sessions/:id')
  getCheckoutSession(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser
  ) {
    return this.paymentsService.finalizeCheckoutSession(user, id);
  }

  @Post('pro-plans')
  requestProPlan(
    @CurrentUser() user: AuthUser,
    @Body() dto: RequestProPlanDto
  ) {
    return this.paymentsService.requestProPlan(user, dto);
  }

  @Get('subscriptions')
  listSubscriptions(@CurrentUser() user: AuthUser) {
    return this.paymentsService.getSubscriptions(user);
  }

  @Post('subscriptions/:id/cancel')
  cancelSubscription(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.paymentsService.cancelSubscription(id, user);
  }

  @Post('subscriptions/:id/resume')
  resumeSubscription(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.paymentsService.resumeSubscription(id, user);
  }

  @Get('wallet')
  getWallet(@CurrentUser() user: AuthUser) {
    return this.paymentsService.getWalletSummary(user);
  }

  @Get('wallet/transactions')
  getWalletTransactions(
    @CurrentUser() user: AuthUser,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('from') from?: string,
    @Query('to') to?: string
  ) {
    const parsedLimit = limit ? Number(limit) : undefined;
    const parsedOffset = offset ? Number(offset) : undefined;
    const parsedFrom = from ? new Date(from) : undefined;
    const parsedTo = to ? new Date(to) : undefined;
    if (parsedTo && to && to.length === 10) {
      parsedTo.setHours(23, 59, 59, 999);
    }
    return this.paymentsService.getWalletTransactions(user, {
      limit: Number.isFinite(parsedLimit) ? parsedLimit : undefined,
      offset: Number.isFinite(parsedOffset) ? parsedOffset : undefined,
      type: type || undefined,
      status: status || undefined,
      from: parsedFrom && !Number.isNaN(parsedFrom.getTime()) ? parsedFrom : undefined,
      to: parsedTo && !Number.isNaN(parsedTo.getTime()) ? parsedTo : undefined
    });
  }

  @Get('wallet/transactions/export')
  async exportWalletTransactions(
    @CurrentUser() user: AuthUser,
    @Query('type') type: string | undefined,
    @Query('status') status: string | undefined,
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Res({ passthrough: true }) res: Response
  ) {
    const parsedFrom = from ? new Date(from) : undefined;
    const parsedTo = to ? new Date(to) : undefined;
    if (parsedTo && to && to.length === 10) {
      parsedTo.setHours(23, 59, 59, 999);
    }
    const csv = await this.paymentsService.exportWalletTransactions(user, {
      type: type || undefined,
      status: status || undefined,
      from: parsedFrom && !Number.isNaN(parsedFrom.getTime()) ? parsedFrom : undefined,
      to: parsedTo && !Number.isNaN(parsedTo.getTime()) ? parsedTo : undefined
    });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="wallet-transactions.csv"');
    return csv;
  }

  @Post('wallet/topup')
  topupWallet(@CurrentUser() user: AuthUser, @Body() dto: WalletTopupDto) {
    return this.paymentsService.initWalletTopup(user, dto);
  }

  @Post('wallet/withdraw')
  withdrawWallet(@CurrentUser() user: AuthUser, @Body() dto: WalletWithdrawDto) {
    return this.paymentsService.withdrawFromWallet(user, dto);
  }

  @Get('zikopay/verify')
  verifyZikopay(@CurrentUser() user: AuthUser, @Query('reference') reference?: string) {
    return this.paymentsService.verifyZikopayReference(user, reference ?? '');
  }

  @Get('flutterwave/verify')
  verifyFlutterwave(@CurrentUser() user: AuthUser, @Query('tx_ref') txRef?: string) {
    return this.paymentsService.verifyFlutterwaveReference(user, txRef ?? '');
  }
}
