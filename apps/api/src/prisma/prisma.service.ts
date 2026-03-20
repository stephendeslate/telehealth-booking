import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * Set RLS context for the current transaction.
   * Must be called within a $transaction callback.
   */
  async setRlsContext(
    tx: PrismaClient,
    practiceId: string,
    userId?: string,
  ) {
    await tx.$executeRawUnsafe(
      `SELECT set_config('app.current_practice', $1, TRUE)`,
      practiceId,
    );
    if (userId) {
      await tx.$executeRawUnsafe(
        `SELECT set_config('app.current_user', $1, TRUE)`,
        userId,
      );
    }
  }

  /**
   * Execute a callback within a practice-scoped transaction with RLS context set.
   */
  async withPracticeContext<T>(
    practiceId: string,
    userId: string | undefined,
    fn: (tx: PrismaClient) => Promise<T>,
  ): Promise<T> {
    return this.$transaction(async (tx: Prisma.TransactionClient) => {
      await this.setRlsContext(tx as unknown as PrismaClient, practiceId, userId);
      return fn(tx as unknown as PrismaClient);
    });
  }
}
