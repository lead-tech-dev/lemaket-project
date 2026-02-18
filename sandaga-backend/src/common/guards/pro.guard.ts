import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable
} from '@nestjs/common';
import { UserRole } from '../enums/user-role.enum';

@Injectable()
export class ProGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user as { role?: UserRole; isPro?: boolean } | undefined;

    if (!user) {
      throw new ForbiddenException('Pro access required');
    }

    if (user.role === UserRole.ADMIN || user.role === UserRole.MODERATOR) {
      return true;
    }

    if (user.isPro) {
      return true;
    }

    throw new ForbiddenException('Pro access required');
  }
}
