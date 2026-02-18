import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = any>(
    _err: any,
    user: TUser,
    _info?: any,
    _context?: ExecutionContext,
    _status?: any
  ): TUser | null {
    return user ?? null;
  }
}
