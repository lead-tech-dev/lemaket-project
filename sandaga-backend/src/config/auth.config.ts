import { registerAs } from '@nestjs/config';

export default registerAs('auth', () => ({
  accessTokenTtlSeconds: Number(process.env.JWT_TTL_SECONDS ?? 3600),
  resetTokenExpiresInMinutes: Number(process.env.RESET_TOKEN_TTL_MINUTES ?? 60)
}));
