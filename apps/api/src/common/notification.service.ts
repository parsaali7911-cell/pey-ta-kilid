import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationService {
  constructor(private readonly prisma: PrismaService) {}

  /** Persist-only notification event (no delivery provider in Phase 0-C). */
  async enqueue(input: {
    userId?: string | null;
    organizationId?: string | null;
    type: string;
    title: string;
    body?: string | null;
    payload?: Record<string, unknown> | null;
  }) {
    return this.prisma.notificationEvent.create({
      data: {
        userId: input.userId ?? null,
        organizationId: input.organizationId ?? null,
        type: input.type,
        title: input.title,
        body: input.body ?? null,
        payload:
          input.payload == null
            ? undefined
            : (input.payload as Prisma.InputJsonValue),
      },
    });
  }
}
