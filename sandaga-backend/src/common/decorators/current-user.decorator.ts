import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface AuthUser {
  id: string;
  role: string;
  email: string;
  isPro?: boolean;
  phoneNumber?: string | null;
  settings?: Record<string, unknown> | null;
  courierVerificationStatus?: 'unverified' | 'pending' | 'approved' | 'rejected';
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthUser | undefined => {
    const request = context.switchToHttp().getRequest();
    return request.user;
  }
);
