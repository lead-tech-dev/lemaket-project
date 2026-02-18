import { Body, Controller, Headers, Post } from '@nestjs/common';
import { PaymentsService } from './payments.service';

@Controller('payments')
export class PaymentsWebhookController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('mtn/webhook')
  handleMtnWebhook(@Body() payload: Record<string, any>) {
    return this.paymentsService.handleMtnWebhook(payload);
  }

  @Post('orange/webhook')
  handleOrangeWebhook(@Body() payload: Record<string, any>) {
    return this.paymentsService.handleOrangeWebhook(payload);
  }

  @Post('flutterwave/webhook')
  handleFlutterwaveWebhook(
    @Body() payload: Record<string, any>,
    @Headers('verif-hash') signature?: string
  ) {
    return this.paymentsService.handleFlutterwaveWebhook(payload, signature);
  }

  @Post('zikopay/webhook')
  handleZikopayWebhook(@Body() payload: Record<string, any>) {
    return this.paymentsService.handleZikopayWebhook(payload);
  }
}
