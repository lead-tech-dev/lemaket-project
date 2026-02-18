export default () => ({
  payments: {
    stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? '',
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? '',
    checkoutSuccessUrl:
      process.env.STRIPE_SUCCESS_URL ??
      'http://localhost:3000/dashboard/payments?status=success&session_id={CHECKOUT_SESSION_ID}',
    checkoutCancelUrl:
      process.env.STRIPE_CANCEL_URL ??
      'http://localhost:3000/dashboard/payments?status=cancel&session_id={CHECKOUT_SESSION_ID}',
    promotionPriceMap: {
      'boost-7': process.env.STRIPE_PRICE_PROMO_BOOST7 ?? '',
      'boost-14': process.env.STRIPE_PRICE_PROMO_BOOST14 ?? '',
      'pack-premium': process.env.STRIPE_PRICE_PROMO_PACK_PREMIUM ?? ''
    },
    proPlanPriceMap: {
      starter:
        process.env.STRIPE_PRICE_PRO_STARTER ??
        process.env.STRIPE_PRICE_PRO_DISCOVERY ??
        '',
      business: process.env.STRIPE_PRICE_PRO_BUSINESS ?? '',
      premium: process.env.STRIPE_PRICE_PRO_PREMIUM ?? ''
    },
    flutterwave: {
      secretKey: process.env.FLW_SECRET_KEY ?? '',
      publicKey: process.env.FLW_PUBLIC_KEY ?? '',
      webhookHash: process.env.FLW_WEBHOOK_HASH ?? '',
      baseUrl: process.env.FLW_BASE_URL ?? 'https://api.flutterwave.com',
      redirectUrl: process.env.FLW_REDIRECT_URL ?? '',
      momoBankCodes: {
        mtn: process.env.FLW_MOMO_BANK_CODE_MTN ?? '',
        orange: process.env.FLW_MOMO_BANK_CODE_ORANGE ?? ''
      }
    },
    zikopay: {
      apiKey: process.env.ZIKOPAY_API_KEY ?? '',
      apiSecret: process.env.ZIKOPAY_API_SECRET ?? '',
      baseUrl: process.env.ZIKOPAY_BASE_URL ?? 'https://api.payment.zikopay.com/v1',
      mockMode: String(process.env.ZIKOPAY_MOCK_MODE ?? 'false').toLowerCase() === 'true',
      returnUrl:
        process.env.ZIKOPAY_RETURN_URL ??
        process.env.APP_PUBLIC_URL ??
        process.env.FRONTEND_URL ??
        'http://localhost:5173',
      cancelUrl:
        process.env.ZIKOPAY_CANCEL_URL ??
        process.env.APP_PUBLIC_URL ??
        process.env.FRONTEND_URL ??
        'http://localhost:5173',
      callbackUrl:
        process.env.ZIKOPAY_CALLBACK_URL ??
        process.env.API_PUBLIC_URL ??
        process.env.BACKEND_URL ??
        'http://localhost:3000'
    },
    deliveryCommissionRate: Number(process.env.DELIVERY_COMMISSION_RATE ?? 0.05),
    platformWalletUserId: process.env.PLATFORM_WALLET_USER_ID ?? ''
  }
});
