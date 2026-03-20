import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Middleware that resolves practice_id from URL params or X-Practice-Id header
 * and attaches it to the request for downstream use.
 *
 * Note: RLS context is set per-transaction in the service layer via
 * prisma.withPracticeContext(), not in middleware, because RLS requires
 * a transaction-scoped set_config call.
 */
@Injectable()
export class PracticeContextMiddleware implements NestMiddleware {
  constructor(private readonly prisma: PrismaService) {}

  async use(req: Request, _res: Response, next: NextFunction) {
    const headerValue = req.headers['x-practice-id'];
    const fromParams = req.params.practiceId as string | undefined;
    const fromHeader = typeof headerValue === 'string' ? headerValue : undefined;
    const practiceId = fromParams || fromHeader;

    if (practiceId) {
      // Verify practice exists
      const practice = await this.prisma.practice.findUnique({
        where: { id: practiceId },
        select: { id: true, timezone: true },
      });

      if (practice) {
        (req as any).practiceId = practice.id;
        (req as any).practiceTimezone = practice.timezone;
      }
    }

    next();
  }
}
