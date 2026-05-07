import { ArgumentsHost, Catch, ExceptionFilter, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Response } from 'express';

type ExceptionPayload = {
  code?: number;
  message?: string | string[];
  details?: unknown;
};

@Catch(UnauthorizedException, ForbiddenException)
export class AuthExceptionFilter implements ExceptionFilter {
  private normalizeMessage(message: string | string[] | undefined, fallback: string): string {
    if (Array.isArray(message)) {
      return message.join('; ');
    }
    return message ?? fallback;
  }

  private getPayload(
    exception: UnauthorizedException | ForbiddenException,
    fallbackCode: number,
    fallbackMessage: string
  ) {
    const response = exception.getResponse();

    if (typeof response === 'string') {
      return {
        code: fallbackCode,
        message: response,
        details: null
      };
    }

    const payload = (response ?? {}) as ExceptionPayload;
    return {
      code: payload.code ?? fallbackCode,
      message: this.normalizeMessage(payload.message, fallbackMessage),
      details: payload.details ?? null
    };
  }

  catch(exception: UnauthorizedException | ForbiddenException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof UnauthorizedException) {
      const payload = this.getPayload(exception, 40101, 'Authentication required');
      response.status(401).json({
        code: payload.code,
        message: payload.message,
        data: null,
        details: payload.details
      });
      return;
    }

    const payload = this.getPayload(exception, 40301, 'Forbidden');
    response.status(403).json({
      code: payload.code,
      message: payload.message,
      data: null,
      details: payload.details
    });
  }
}
