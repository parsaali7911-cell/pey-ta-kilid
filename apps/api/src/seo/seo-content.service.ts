import { Injectable } from '@nestjs/common';
import { LocalizedEntityType } from '@prisma/client';
import {
  SEO_LOCALES,
  autoGenerateListingSeo,
  autoGenerateProfessionalSeo,
} from '@peytakilid/shared-types';
import { LocalizationService } from '../i18n/localization.service';
import { specialtyLabel } from '../geo/iran-place';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Auto SEO on product / professional entry — deterministic templates (no manual copy).
 * Optional AI polish can be layered later without changing hooks.
 */
@Injectable()
export class SeoContentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly localization: LocalizationService,
  ) {}

  async ensureListingSeo(listingId: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      include: {
        category: { select: { nameEn: true, nameFa: true, nameAr: true } },
        facility: { include: { address: { select: { city: true, province: true } } } },
      },
    });
    if (!listing) return null;

    const city = listing.facility?.address?.city || null;

    for (const locale of SEO_LOCALES) {
      const categoryName =
        locale === 'fa'
          ? listing.category.nameFa || listing.category.nameEn
          : locale === 'ar'
            ? listing.category.nameAr || listing.category.nameEn
            : listing.category.nameEn;

      const generated = autoGenerateListingSeo({
        title: listing.title,
        description: listing.description,
        categoryName,
        city,
        locale,
        brand: locale === 'fa' ? 'پی‌تا‌کلید' : locale === 'ar' ? 'بي تا كليد' : 'Peytakilid',
      });

      await this.localization.upsertContent({
        entityType: LocalizedEntityType.LISTING,
        entityId: listing.id,
        localeCode: locale,
        field: 'seoTitle',
        value: generated.seoTitle,
      });
      await this.localization.upsertContent({
        entityType: LocalizedEntityType.LISTING,
        entityId: listing.id,
        localeCode: locale,
        field: 'seoDescription',
        value: generated.seoDescription,
      });
    }

    return { listingId: listing.id, locales: [...SEO_LOCALES] };
  }

  async ensureProfessionalSeo(organizationId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        facilities: {
          where: { isPublicLocation: true },
          take: 1,
          include: { address: { select: { city: true, province: true } } },
        },
      },
    });
    if (!org || !org.isProfessional) return null;

    const city = org.facilities[0]?.address?.city || null;
    const province = org.facilities[0]?.address?.province || null;
    const specialtyFa = specialtyLabel(org.primarySpecialty, 'fa');
    const specialtyEn = specialtyLabel(org.primarySpecialty, 'en');

    const fa = autoGenerateProfessionalSeo({
      name: org.name,
      specialtyLabel: specialtyFa,
      city,
      province,
      locale: 'fa',
      brand: 'پی‌تا‌کلید',
    });
    const en = autoGenerateProfessionalSeo({
      name: org.name,
      specialtyLabel: specialtyEn,
      city,
      province,
      locale: 'en',
      brand: 'Peytakilid',
    });

    await this.prisma.organization.update({
      where: { id: org.id },
      data: {
        seoTitle: fa.seoTitle,
        seoDescription: fa.seoDescription,
      },
    });

    return {
      organizationId: org.id,
      seoTitle: fa.seoTitle,
      seoDescription: fa.seoDescription,
      seoTitleEn: en.seoTitle,
      seoDescriptionEn: en.seoDescription,
    };
  }
}
