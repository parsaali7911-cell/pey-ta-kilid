import { Injectable } from '@nestjs/common';
import { AiUsageOperation, Prisma } from '@prisma/client';
import {
  AiUsageRecordInput,
  AiUsageSummary,
  estimateOpenAiCostUsd,
  sanitizeAiUsageMetadata,
} from '@peytakilid/shared-types';
import { appEnv } from '../env';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AiUsageService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: AiUsageRecordInput) {
    const estimatedCostUsd =
      input.estimatedCostUsd ??
      estimateOpenAiCostUsd({
        inputTokens: input.inputTokens,
        outputTokens: input.outputTokens,
        inputPer1M: appEnv.OPENAI_INPUT_COST_PER_1M,
        outputPer1M: appEnv.OPENAI_OUTPUT_COST_PER_1M,
      });

    const metadata = sanitizeAiUsageMetadata(input.metadata);
    return this.prisma.aiUsageEvent.create({
      data: {
        provider: input.provider,
        operation: input.operation as AiUsageOperation,
        sourceLocale: input.sourceLocale ?? null,
        targetLocale: input.targetLocale ?? null,
        model: input.model ?? null,
        requestCount: input.requestCount ?? 1,
        inputTokens: input.inputTokens ?? null,
        outputTokens: input.outputTokens ?? null,
        estimatedCostUsd:
          estimatedCostUsd == null ? null : new Prisma.Decimal(estimatedCostUsd),
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        field: input.field ?? null,
        metadata: metadata == null ? undefined : (metadata as Prisma.InputJsonValue),
      },
    });
  }

  /** Admin usage ledger — never includes API keys. */
  async summarize(opts?: { operation?: string; since?: Date }) {
    const where: Prisma.AiUsageEventWhereInput = {
      ...(opts?.operation ? { operation: opts.operation as AiUsageOperation } : {}),
      ...(opts?.since ? { createdAt: { gte: opts.since } } : {}),
    };

    const rows = await this.prisma.aiUsageEvent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const bucket = new Map<string, AiUsageSummary>();
    for (const row of rows) {
      const key = `${row.provider}:${row.operation}`;
      const cur = bucket.get(key) ?? {
        operation: row.operation,
        provider: row.provider,
        requestCount: 0,
        inputTokens: 0,
        outputTokens: 0,
        estimatedCostUsd: 0,
      };
      cur.requestCount += row.requestCount;
      cur.inputTokens += row.inputTokens ?? 0;
      cur.outputTokens += row.outputTokens ?? 0;
      cur.estimatedCostUsd += row.estimatedCostUsd ? Number(row.estimatedCostUsd) : 0;
      bucket.set(key, cur);
    }

    return {
      totals: [...bucket.values()],
      recent: rows.map((r) => ({
        id: r.id,
        provider: r.provider,
        operation: r.operation,
        sourceLocale: r.sourceLocale,
        targetLocale: r.targetLocale,
        model: r.model,
        requestCount: r.requestCount,
        inputTokens: r.inputTokens,
        outputTokens: r.outputTokens,
        estimatedCostUsd: r.estimatedCostUsd ? Number(r.estimatedCostUsd) : null,
        entityType: r.entityType,
        entityId: r.entityId,
        createdAt: r.createdAt,
      })),
    };
  }
}
