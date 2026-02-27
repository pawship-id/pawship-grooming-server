import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Request } from 'express';
import { Observable, tap } from 'rxjs';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('Response');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    const { method, originalUrl } = req;
    const handlerName = context.getHandler().name;
    const className = context.getClass().name;

    this.logger.debug(
      `Handling [${className}.${handlerName}] → ${method} ${originalUrl}`,
    );

    return next.handle().pipe(
      tap((data: unknown) => {
        this.logger.debug(
          `Response [${className}.${handlerName}] → ${JSON.stringify(data).slice(0, 200)}`,
        );
      }),
    );
  }
}
