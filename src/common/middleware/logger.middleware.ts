import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction): void {
    const { method, originalUrl, ip } = req;
    const userAgent = req.get('user-agent') ?? '-';
    const startTime = Date.now();

    this.logger.log(
      `→ ${method} ${originalUrl} | IP: ${ip} | UA: ${userAgent}`,
    );

    res.on('finish', () => {
      const { statusCode } = res;
      const contentLength = res.get('content-length') ?? '-';
      const elapsedMs = Date.now() - startTime;

      const logMessage = `← ${method} ${originalUrl} | ${statusCode} | ${elapsedMs}ms | ${contentLength}B`;

      if (statusCode >= 500) {
        this.logger.error(logMessage);
      } else if (statusCode >= 400) {
        this.logger.warn(logMessage);
      } else {
        this.logger.log(logMessage);
      }
    });

    next();
  }
}
