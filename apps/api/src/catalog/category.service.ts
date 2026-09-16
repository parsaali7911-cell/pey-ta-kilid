import { Injectable, NotFoundException } from '@nestjs/common';
import { LocalizedEntityType, Prisma } from '@prisma/client';
import { resolveLocalizedValue } from '@peytakilid/shared-types';
import { TranslationService } from '../ai/translation.service';
import { LocalizationService } from '../i18n/localization.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAttributeDefinitionDto } from './dto/attribute.dto';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';

@Injectable()
export class CategoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly localization: LocalizationService,
    private readonly translation: TranslationService,
  ) {}

  async create(dto: CreateCategoryDto) {
    const category = await this.prisma.category.create({
      data: {
        slug: dto.slug.toLowerCase(),
        nameEn: dto.nameEn,
        nameFa: dto.nameFa,
        nameAr: dto.nameAr,
        parentId: dto.parentId,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
    await this.syncCategoryNameTranslations(category.id, {
      en: dto.nameEn,
      fa: dto.nameFa,
      ar: dto.nameAr,
    });
    // Translate missing locale names from English source when provided.
    if (dto.nameEn) {
      const targetLocales = [
        ...(dto.nameFa ? [] : (['fa'] as string[])),
        ...(dto.nameAr ? [] : (['ar'] as string[])),
      ];
      if (targetLocales.length) {
        this.translation.scheduleAfterContentChange({
          entityType: 'CATEGORY',
          entityId: category.id,
          sourceLocale: 'en',
          fields: [{ field: 'name', sourceText: dto.nameEn }],
          targetLocales,
        });
      }
    }
    return category;
  }

  async update(id: string, dto: UpdateCategoryDto) {
    await this.getOrThrow(id);
    const category = await this.prisma.category.update({
      where: { id },
      data: {
        nameEn: dto.nameEn,
        nameFa: dto.nameFa,
        nameAr: dto.nameAr,
        parentId: dto.parentId,
        sortOrder: dto.sortOrder,
        isActive: dto.isActive,
      },
    });
    await this.syncCategoryNameTranslations(id, {
      en: dto.nameEn ?? category.nameEn,
      fa: dto.nameFa ?? category.nameFa,
      ar: dto.nameAr ?? category.nameAr,
    });
    return category;
  }

  async listTree(locale?: string) {
    const resolved = await this.localization.resolveLocale(locale);
    const rows = await this.prisma.category.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { nameEn: 'asc' }],
    });
    return Promise.all(rows.map((row) => this.toLocalizedCategory(row, resolved.code)));
  }

  async getOrThrow(id: string) {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  createAttribute(categoryId: string, dto: CreateAttributeDefinitionDto) {
    return this.prisma.attributeDefinition.create({
      data: {
        categoryId,
        code: dto.code,
        dataType: dto.dataType,
        unit: dto.unit,
        required: dto.required ?? false,
        filterable: dto.filterable ?? false,
        facetable: dto.facetable ?? false,
        facetOrder: dto.facetOrder,
        nameEn: dto.nameEn,
        nameFa: dto.nameFa,
        nameAr: dto.nameAr,
        enumOptions: dto.enumOptions as Prisma.InputJsonValue | undefined,
        inheritToChildren: dto.inheritToChildren ?? true,
      },
    });
  }

  /** Effective attributes: walk ancestors → child; same code overridden by nearest category. */
  async getEffectiveAttributes(categoryId: string) {
    const chain: string[] = [];
    let current: string | null = categoryId;
    while (current) {
      chain.push(current);
      const node: { parentId: string | null } | null = await this.prisma.category.findUnique({
        where: { id: current },
        select: { parentId: true },
      });
      if (!node) throw new NotFoundException('Category not found');
      current = node.parentId;
    }

    const byCode = new Map<string, unknown>();
    for (const id of [...chain].reverse()) {
      const defs = await this.prisma.attributeDefinition.findMany({
        where: { categoryId: id, isActive: true },
        orderBy: [{ facetOrder: 'asc' }, { code: 'asc' }],
      });
      for (const def of defs) {
        if (id !== categoryId && !def.inheritToChildren) continue;
        byCode.set(def.code, def);
      }
    }
    return [...byCode.values()];
  }

  private async syncCategoryNameTranslations(
    categoryId: string,
    names: { en?: string | null; fa?: string | null; ar?: string | null },
  ) {
    for (const [localeCode, value] of Object.entries(names)) {
      if (!value) continue;
      await this.localization.upsertContent({
        entityType: LocalizedEntityType.CATEGORY,
        entityId: categoryId,
        localeCode,
        field: 'name',
        value,
      });
    }
  }

  private async toLocalizedCategory(
    category: {
      id: string;
      parentId: string | null;
      slug: string;
      nameEn: string;
      nameFa: string | null;
      nameAr: string | null;
      isActive: boolean;
      sortOrder: number;
    },
    locale: string,
  ) {
    const map = await this.localization.getFieldMap(
      LocalizedEntityType.CATEGORY,
      category.id,
      'name',
    );
    const name = resolveLocalizedValue({
      locale,
      translations: {
        ...map,
        en: map.en || category.nameEn,
        fa: map.fa || category.nameFa,
        ar: map.ar || category.nameAr,
      },
      fallback: category.nameEn,
    });
    return {
      id: category.id,
      parentId: category.parentId,
      slug: category.slug,
      name,
      nameEn: category.nameEn,
      nameFa: category.nameFa,
      nameAr: category.nameAr,
      locale,
      isActive: category.isActive,
      sortOrder: category.sortOrder,
    };
  }
}
