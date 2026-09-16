import { Injectable, Logger } from '@nestjs/common';
import { LocalizedEntityType, TranslationStatus } from '@prisma/client';
import {
  AiUsageOperation,
  buildTranslationSystemPrompt,
  buildTranslationUserPrompt,
  defaultTargetLocales,
  hashTranslationSource,
  normalizeSourceText,
  parseTranslationPayload,
  ScheduleTranslationResult,
  TranslateContentRequest,
  TranslateContentResult,
  TranslationFieldResult,
  TranslationJobStatus,
} from '@peytakilid/shared-types';
import { LocalizationService } from '../i18n/localization.service';
import { PrismaService } from '../prisma/prisma.service';
import { AiGatewayService } from './ai-gateway.service';
import { AiUsageService } from './ai-usage.service';

/**
 * Phase 0-H translation foundation.
 * All LLM calls go through AiGatewayService. Failures never destroy source content.
 */
@Injectable()
export class TranslationService {
  private readonly logger = new Logger(TranslationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly localization: LocalizationService,
    private readonly ai: AiGatewayService,
    private readonly usage: AiUsageService,
  ) {}

  /** Non-blocking schedule for create/update hooks. */
  scheduleAfterContentChange(
    request: TranslateContentRequest,
  ): ScheduleTranslationResult {
    setImmediate(() => {
      void this.translateContent(request).catch((err) => {
        this.logger.warn(
          `translation_async_failed entity=${request.entityType}:${request.entityId} err=${
            (err as Error)?.message ?? err
          }`,
        );
      });
    });
    return {
      accepted: true,
      mode: 'async',
      entityType: request.entityType,
      entityId: request.entityId,
    };
  }

  async translateContent(
    request: TranslateContentRequest,
  ): Promise<TranslateContentResult> {
    const entityType = toLocalizedEntityType(request.entityType);
    const sourceLocale = request.sourceLocale;
    const targets = request.targetLocales?.length
      ? request.targetLocales
      : defaultTargetLocales(sourceLocale);

    const preservedSource: Record<string, string | null> = {};
    const prepared: Array<{ field: string; sourceText: string; sourceHash: string }> = [];

    for (const f of request.fields) {
      const normalized = normalizeSourceText(f.sourceText);
      preservedSource[f.field] = normalized;
      if (normalized == null) continue;

      await this.localization.upsertContent({
        entityType,
        entityId: request.entityId,
        localeCode: sourceLocale,
        field: f.field,
        value: normalized,
      });

      prepared.push({
        field: f.field,
        sourceText: normalized,
        sourceHash: hashTranslationSource(normalized, sourceLocale),
      });
    }

    const results: TranslationFieldResult[] = [];

    for (const targetLocale of targets) {
      if (targetLocale === sourceLocale) continue;

      const pending: typeof prepared = [];
      for (const item of prepared) {
        const existing = await this.prisma.translationRecord.findUnique({
          where: {
            entityType_entityId_field_sourceLocale_targetLocale: {
              entityType,
              entityId: request.entityId,
              field: item.field,
              sourceLocale,
              targetLocale,
            },
          },
        });

        if (
          existing?.status === TranslationStatus.READY &&
          existing.sourceHash === item.sourceHash &&
          existing.translatedText != null
        ) {
          results.push({
            field: item.field,
            targetLocale,
            status: TranslationJobStatus.SKIPPED,
            translatedText: existing.translatedText,
            sourceHash: item.sourceHash,
            cached: true,
          });
          continue;
        }

        if (existing && existing.sourceHash !== item.sourceHash) {
          await this.prisma.translationRecord.update({
            where: { id: existing.id },
            data: { status: TranslationStatus.STALE },
          });
        }
        pending.push(item);
      }

      if (!pending.length) continue;

      const fieldMap: Record<string, string | null> = {};
      for (const p of pending) fieldMap[p.field] = p.sourceText;

      try {
        const completion = await this.ai.complete({
          system: buildTranslationSystemPrompt(),
          prompt: buildTranslationUserPrompt({
            sourceLocale,
            targetLocale,
            fields: fieldMap,
          }),
          maxOutputTokens: 512,
        });

        const parsed = parseTranslationPayload(
          completion.text,
          pending.map((p) => p.field),
        );

        await this.usage.record({
          provider: completion.provider,
          operation: AiUsageOperation.TRANSLATION,
          sourceLocale,
          targetLocale,
          model: completion.model ?? null,
          requestCount: 1,
          inputTokens: completion.usage?.inputTokens ?? null,
          outputTokens: completion.usage?.outputTokens ?? null,
          entityType: request.entityType,
          entityId: request.entityId,
          metadata: { fieldCount: pending.length },
        });

        for (const item of pending) {
          const translated = parsed[item.field];
          if (translated == null) {
            await this.upsertRecord({
              entityType,
              entityId: request.entityId,
              field: item.field,
              sourceLocale,
              targetLocale,
              sourceHash: item.sourceHash,
              status: TranslationStatus.FAILED,
              provider: completion.provider,
              model: completion.model ?? null,
              translatedText: null,
              errorMessage: 'null_translation',
            });
            results.push({
              field: item.field,
              targetLocale,
              status: TranslationJobStatus.FAILED,
              translatedText: null,
              sourceHash: item.sourceHash,
              cached: false,
              errorMessage: 'null_translation',
            });
            continue;
          }

          await this.localization.upsertContent({
            entityType,
            entityId: request.entityId,
            localeCode: targetLocale,
            field: item.field,
            value: translated,
          });

          await this.upsertRecord({
            entityType,
            entityId: request.entityId,
            field: item.field,
            sourceLocale,
            targetLocale,
            sourceHash: item.sourceHash,
            status: TranslationStatus.READY,
            provider: completion.provider,
            model: completion.model ?? null,
            translatedText: translated,
            errorMessage: null,
          });

          results.push({
            field: item.field,
            targetLocale,
            status: TranslationJobStatus.READY,
            translatedText: translated,
            sourceHash: item.sourceHash,
            cached: false,
          });
        }
      } catch (err) {
        const message = ((err as Error)?.message ?? String(err)).slice(0, 500);
        for (const item of pending) {
          await this.upsertRecord({
            entityType,
            entityId: request.entityId,
            field: item.field,
            sourceLocale,
            targetLocale,
            sourceHash: item.sourceHash,
            status: TranslationStatus.FAILED,
            provider: this.ai.getProviderName(),
            model: null,
            translatedText: null,
            errorMessage: message,
          });
          results.push({
            field: item.field,
            targetLocale,
            status: TranslationJobStatus.FAILED,
            translatedText: null,
            sourceHash: item.sourceHash,
            cached: false,
            errorMessage: message.slice(0, 200),
          });
        }
      }
    }

    return {
      entityType: request.entityType,
      entityId: request.entityId,
      sourceLocale,
      results,
      preservedSource,
    };
  }

  private upsertRecord(input: {
    entityType: LocalizedEntityType;
    entityId: string;
    field: string;
    sourceLocale: string;
    targetLocale: string;
    sourceHash: string;
    status: TranslationStatus;
    provider: string | null;
    model: string | null;
    translatedText: string | null;
    errorMessage: string | null;
  }) {
    return this.prisma.translationRecord.upsert({
      where: {
        entityType_entityId_field_sourceLocale_targetLocale: {
          entityType: input.entityType,
          entityId: input.entityId,
          field: input.field,
          sourceLocale: input.sourceLocale,
          targetLocale: input.targetLocale,
        },
      },
      create: {
        ...input,
        attemptCount: 1,
        lastAttemptAt: new Date(),
      },
      update: {
        sourceHash: input.sourceHash,
        status: input.status,
        provider: input.provider,
        model: input.model,
        translatedText: input.translatedText,
        errorMessage: input.errorMessage,
        attemptCount: { increment: 1 },
        lastAttemptAt: new Date(),
      },
    });
  }
}

function toLocalizedEntityType(value: string): LocalizedEntityType {
  if (value === 'CATEGORY') return LocalizedEntityType.CATEGORY;
  if (value === 'ATTRIBUTE_DEFINITION') return LocalizedEntityType.ATTRIBUTE_DEFINITION;
  return LocalizedEntityType.LISTING;
}
