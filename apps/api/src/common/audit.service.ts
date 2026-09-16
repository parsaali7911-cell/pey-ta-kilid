import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: {
    actorUserId?: string | null;
    organizationId?: string | null;
    entityType: string;
    entityId: string;
    action: string;
    metadata?: Record<string, unknown> | null;
  }) {
    return this.prisma.auditEvent.create({
      data: {
        actorUserId: input.actorUserId ?? null,
        organizationId: input.organizationId ?? null,
        entityType: input.entityType,
        entityId: input.entityId,
        action: input.action,
        metadata:
          input.metadata == null
            ? undefined
            : (input.metadata as Prisma.InputJsonValue),
      },
    });
  }
}
