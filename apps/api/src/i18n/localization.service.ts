import { Injectable, NotFoundException } from '@nestjs/common';
import { LocalizedEntityType, TextDirection } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LocalizationService {
  constructor(private readonly prisma: PrismaService) {}

  listLocales() {
    return this.prisma.locale.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
    });
  }

  async getDefaultLocaleCode(): Promise<string> {
    const locale = await this.prisma.locale.findFirst({
      where: { isDefault: true, isActive: true },
    });
    return locale?.code ?? 'fa';
  }

  async resolveLocale(requested?: string | null): Promise<{
    code: string;
    direction: TextDirection;
    isRtl: boolean;
  }> {
    const code = (requested || (await this.getDefaultLocaleCode())).toLowerCase();
    const locale = await this.prisma.locale.findFirst({
      where: { code, isActive: true },
    });
    if (locale) {
      return {
        code: locale.code,
        direction: locale.direction,
        isRtl: locale.direction === TextDirection.RTL,
      };
    }
    const fallbackCode = await this.getDefaultLocaleCode();
    const fallback = await this.prisma.locale.findUnique({ where: { code: fallbackCode } });
    return {
      code: fallbackCode,
      direction: fallback?.direction ?? TextDirection.RTL,
      isRtl: (fallback?.direction ?? TextDirection.RTL) === TextDirection.RTL,
    };
  }

  async upsertContent(input: {
    entityType: LocalizedEntityType;
    entityId: string;
    localeCode: string;
    field: string;
    value: string;
  }) {
    const locale = await this.prisma.locale.findFirst({
      where: { code: input.localeCode, isActive: true },
    });
    if (!locale) throw new NotFoundException(`Locale not found: ${input.localeCode}`);

    return this.prisma.localizedContent.upsert({
      where: {
        entityType_entityId_localeCode_field: {
          entityType: input.entityType,
          entityId: input.entityId,
          localeCode: input.localeCode,
          field: input.field,
        },
      },
      create: input,
      update: { value: input.value },
    });
  }

  async getFieldMap(
    entityType: LocalizedEntityType,
    entityId: string,
    field: string,
  ): Promise<Record<string, string>> {
    const rows = await this.prisma.localizedContent.findMany({
      where: { entityType, entityId, field },
    });
    return Object.fromEntries(rows.map((r) => [r.localeCode, r.value]));
  }

  async resolveField(input: {
    entityType: LocalizedEntityType;
    entityId: string;
    field: string;
    locale: string;
    fallback?: string | null;
  }): Promise<string | null> {
    const map = await this.getFieldMap(input.entityType, input.entityId, input.field);
    const defaultLocale = await this.getDefaultLocaleCode();
    return (
      map[input.locale] ||
      map[defaultLocale] ||
      map.en ||
      input.fallback ||
      null
    );
  }
}
