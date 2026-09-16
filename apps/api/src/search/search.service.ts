import { Injectable } from '@nestjs/common';
import { ListingStatus, LocalizedEntityType, MediaStatus, Prisma } from '@prisma/client';
import {
  DEFAULT_SEARCH_RANKING_WEIGHTS,
  RankedRecommendation,
  RequestIntent,
  SearchQuery,
  SearchRankingWeights,
  StructuredRequirements,
} from '@peytakilid/shared-types';
import { resolveLocalizedValue } from '@peytakilid/shared-types';
import { LocalizationService } from '../i18n/localization.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  normalizeSearchQuery,
  requirementsToSearchQuery,
} from './search-query.adapter';
import { flattenAttributes, SearchListingRow, toSearchHit } from './search.mapper';
import { rankListing } from './search.ranking';

@Injectable()
export class SearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly localization: LocalizationService,
  ) {}

  /** Intent bridge — does not live in Intent module. */
  fromRequirements(
    requirements: StructuredRequirements,
    opts?: { limit?: number; offset?: number },
  ): SearchQuery {
    return requirementsToSearchQuery(requirements, opts);
  }

  async search(
    input: SearchQuery,
    weights: SearchRankingWeights = DEFAULT_SEARCH_RANKING_WEIGHTS,
  ): Promise<RankedRecommendation> {
    const query = normalizeSearchQuery(input);
    const filters = query.filters!;
    const locale = (await this.localization.resolveLocale(filters.locale)).code;

    // Professionals/design are out of product catalog search scope for Phase 0-G.
    if (
      query.requirements.intent === RequestIntent.PROFESSIONAL ||
      query.requirements.intent === RequestIntent.AMBIGUOUS
    ) {
      return {
        hits: [],
        strategy: 'rule',
        explanation: `intent_${query.requirements.intent.toLowerCase()}_not_product_search`,
        totalCandidates: 0,
      };
    }

    const categoryIds = await this.resolveCategoryIds(filters.categoryIds, filters.categoryHints);

    // Hard text filter only when we lack category anchors — otherwise NL stopwords
    // (کمترین، میخوام، توی…) wipe the candidate set before ranking.
    const hardText =
      !categoryIds.length && filters.text
        ? filters.text
            .split(/[\s,،]+/)
            .map((t) => t.trim())
            .filter((t) => t.length > 2)
            .filter(
              (t) =>
                !/^(می[\u200c]?خوا(?:م|هم)|توی|تو|با|از|برای|رنج|کمترین|ارزان|قیمت|و|در|the|a|an|in|at|with|lowest|price|want)$/i.test(
                  t,
                ),
            )
            .slice(0, 6)
        : [];

    const where: Prisma.ListingWhereInput = {
      status: ListingStatus.PUBLISHED,
      ...(categoryIds.length ? { categoryId: { in: categoryIds } } : {}),
      ...(filters.listingIds?.length
        ? {
            OR: [
              { id: { in: filters.listingIds } },
              { publicId: { in: filters.listingIds } },
              { slug: { in: filters.listingIds } },
            ],
          }
        : {}),
      ...(filters.uomCode ? { uomCode: filters.uomCode } : {}),
      ...(filters.currency || filters.priceMin != null || filters.priceMax != null
        ? {
            price: {
              is: {
                ...(filters.currency ? { currency: filters.currency as never } : {}),
                ...(filters.priceMin != null || filters.priceMax != null
                  ? {
                      displayPrice: {
                        ...(filters.priceMin != null ? { gte: filters.priceMin } : {}),
                        ...(filters.priceMax != null ? { lte: filters.priceMax } : {}),
                      },
                    }
                  : {}),
              },
            },
          }
        : {}),
      ...(hardText.length
        ? {
            OR: hardText.flatMap((needle) => [
              { title: { contains: needle, mode: 'insensitive' as const } },
              { description: { contains: needle, mode: 'insensitive' as const } },
              { slug: { contains: needle, mode: 'insensitive' as const } },
            ]),
          }
        : {}),
    };

    // Market is carried for future listing-market scoping; soft preference via currency only.
    if (filters.market === 'IRAN' && !filters.currency) {
      // do not hard-filter — ranking remains category-agnostic
    }

    const rows = (await this.prisma.listing.findMany({
      where,
      include: {
        category: true,
        organization: { select: { id: true, name: true, slug: true } },
        attributes: { include: { attributeDefinition: true } },
        price: true,
        inventory: true,
        facility: { include: { address: true } },
        media: {
          where: { status: MediaStatus.APPROVED },
          orderBy: { sortOrder: 'asc' },
          take: 1,
          select: { url: true, status: true, sortOrder: true },
        },
        product: { select: { id: true, slug: true, name: true } },
        variant: { select: { id: true, sku: true, name: true } },
      },
      take: 200,
    })) as unknown as SearchListingRow[];

    const scored = [];
    for (const listing of rows) {
      const titleMap = await this.localization.getFieldMap(
        LocalizedEntityType.LISTING,
        listing.id,
        'title',
      );
      const localizedTitle =
        resolveLocalizedValue({
          locale,
          translations: { ...titleMap, en: titleMap.en || listing.title },
          fallback: listing.title,
        }) || listing.title;

      const categoryName = resolveCategoryName(listing.category, locale);
      const publicPrice = listing.price
        ? Number(listing.price.displayPrice)
        : null;
      const available = listing.inventory
        ? Math.max(0, Number(listing.inventory.onHand) - Number(listing.inventory.reserved))
        : null;

      const facilityPublic =
        listing.facility && listing.facility.isPublicLocation
          ? {
              id: listing.facility.id,
              city: listing.facility.address.city,
              province: listing.facility.address.province,
              countryCode: listing.facility.address.countryCode,
            }
          : null;

      const rank = rankListing(
        {
          id: listing.id,
          title: localizedTitle,
          description: listing.description,
          slug: listing.slug,
          uomCode: listing.uomCode,
          moq: listing.moq == null ? null : Number(listing.moq),
          leadTimeDays: listing.leadTimeDays,
          category: listing.category,
          attributes: flattenAttributes(listing),
          displayPrice: publicPrice,
          currency: listing.price?.currency ?? null,
          available,
          facilityPublic,
        },
        filters,
        weights,
      );

      if (rank.excluded) continue;

      const hit = toSearchHit({
        listing,
        localizedTitle,
        localeCategoryName: categoryName,
        score: rank.score,
        matchedAttributes: rank.matchedAttributes,
        scoreComponents: rank.scoreComponents,
      });
      scored.push(hit);
    }

    scored.sort((a, b) => b.score - a.score || a.listingId.localeCompare(b.listingId));

    if (filters.preferCheapest) {
      const cityNeedle = (filters.preferredCity || '').toLowerCase();
      scored.sort((a, b) => {
        const aCity = (a.preview.facilityPublic?.city || '').toLowerCase();
        const bCity = (b.preview.facilityPublic?.city || '').toLowerCase();
        const aLocal =
          cityNeedle && (aCity.includes(cityNeedle) || cityNeedle.includes(aCity)) ? 1 : 0;
        const bLocal =
          cityNeedle && (bCity.includes(cityNeedle) || cityNeedle.includes(bCity)) ? 1 : 0;
        if (aLocal !== bLocal) return bLocal - aLocal;
        const ap = a.preview.displayPrice;
        const bp = b.preview.displayPrice;
        if (ap == null && bp == null) return b.score - a.score;
        if (ap == null) return 1;
        if (bp == null) return -1;
        if (ap !== bp) return ap - bp;
        return b.score - a.score;
      });
    }

    const offset = query.offset ?? 0;
    const limit = query.limit ?? 20;
    const hits = scored.slice(offset, offset + limit);

    return {
      hits,
      strategy: 'rule',
      explanation: filters.preferCheapest
        ? `rule_rank_prefer_cheapest candidates=${rows.length} matched=${scored.length} locale=${locale}`
        : `rule_rank candidates=${rows.length} matched=${scored.length} locale=${locale}`,
      totalCandidates: scored.length,
    };
  }

  private async resolveCategoryIds(
    categoryIds: string[] | undefined,
    categoryHints: string[] | undefined,
  ): Promise<string[]> {
    if (categoryIds?.length) return categoryIds;
    if (!categoryHints?.length) return [];

    const categories = await this.prisma.category.findMany({
      where: { isActive: true },
      select: { id: true, slug: true, nameEn: true, nameFa: true, nameAr: true },
    });
    const ids = new Set<string>();
    for (const hint of categoryHints) {
      const h = hint.toLowerCase();
      for (const c of categories) {
        const blob = `${c.slug} ${c.nameEn} ${c.nameFa || ''} ${c.nameAr || ''}`.toLowerCase();
        if (blob.includes(h)) ids.add(c.id);
      }
    }
    return [...ids];
  }
}

function resolveCategoryName(
  category: { nameEn: string; nameFa: string | null; nameAr: string | null },
  locale: string,
): string {
  if (locale === 'fa' && category.nameFa) return category.nameFa;
  if (locale === 'ar' && category.nameAr) return category.nameAr;
  return category.nameEn;
}
