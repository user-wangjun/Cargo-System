import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

type JwtErrorInfo = {
  name?: string;
};

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  handleRequest<TUser = unknown>(err: unknown, user: TUser, info: JwtErrorInfo | Error | string | undefined): TUser {
    if (user) {
      return user;
    }

    if (err) {
      throw err;
    }

    const infoName =
      info instanceof Error ? info.name : typeof info === 'object' && info ? info.name : undefined;

    if (infoName === 'TokenExpiredError') {
      throw new UnauthorizedException({
        code: 40111,
        message: 'Access token expired'
      });
    }

    if (infoName === 'JsonWebTokenError' || infoName === 'NotBeforeError') {
      throw new UnauthorizedException({
        code: 40112,
        message: 'Invalid access token'
      });
    }

    throw new UnauthorizedException({
      code: 40101,
      message: 'Authentication required'
    });
  }
}
