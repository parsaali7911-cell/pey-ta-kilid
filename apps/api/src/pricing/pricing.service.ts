import { Injectable, NotFoundException } from '@nestjs/common';
import { CurrencyCode, PriceType, Prisma, RoundingMode } from '@prisma/client';
import {
  calculateBuyerDisplayPrice,
  RoundingMode as SharedRoundingMode,
} from '@peytakilid/shared-types';
import { AuditService } from '../common/audit.service';
import { toPublicPrice, toSellerPrice } from '../common/contracts/listing-contracts';
import { NotificationService } from '../common/notification.service';
import { PrismaService } from '../prisma/prisma.service';

export type QuoteInput = {
  supplierCost: number;
  currency: CurrencyCode;
  displayCurrency?: CurrencyCode;
};

@Injectable()
export class PricingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationService,
  ) {}

  async getSettings() {
    const existing = await this.prisma.pricingSettings.findUnique({ where: { key: 'default' } });
    if (existing) return existing;
    return this.prisma.pricingSettings.create({
      data: {
        key: 'default',
        marginPercent: 0,
        flatFee: 0,
        roundingMode: RoundingMode.NONE,
      },
    });
  }

  async updateSettings(data: {
    marginPercent?: number;
    flatFee?: number;
    flatFeeCurrency?: CurrencyCode | null;
    roundingMode?: RoundingMode;
    roundingUnit?: number | null;
    fxRates?: Record<string, number> | null;
  }) {
    await this.getSettings();
    return this.prisma.pricingSettings.update({
      where: { key: 'default' },
      data: {
        marginPercent: data.marginPercent,
        flatFee: data.flatFee,
        flatFeeCurrency: data.flatFeeCurrency === undefined ? undefined : data.flatFeeCurrency,
        roundingMode: data.roundingMode,
        roundingUnit: data.roundingUnit === undefined ? undefined : data.roundingUnit,
        fxRates:
          data.fxRates === undefined
            ? undefined
            : data.fxRates === null
              ? Prisma.JsonNull
              : (data.fxRates as Prisma.InputJsonValue),
      },
    });
  }

  async quote(input: QuoteInput) {
    const settings = await this.getSettings();
    const displayCurrency = input.displayCurrency ?? input.currency;
    const fxRate = this.resolveFxRate(
      input.currency,
      displayCurrency,
      settings.fxRates as Record<string, number> | null,
    );
    const flatFee =
      settings.flatFeeCurrency && settings.flatFeeCurrency !== displayCurrency
        ? 0
        : Number(settings.flatFee);

    return calculateBuyerDisplayPrice(input.supplierCost, {
      marginPercent: Number(settings.marginPercent),
      flatFee,
      roundingMode: settings.roundingMode as unknown as SharedRoundingMode,
      roundingUnit: settings.roundingUnit == null ? null : Number(settings.roundingUnit),
      fxRate,
    });
  }

  async setListingPrice(
    listingId: string,
    input: {
      supplierCost: number;
      currency: CurrencyCode;
      priceType: PriceType;
      displayCurrency?: CurrencyCode;
    },
  ) {
    const listing = await this.prisma.listing.findUnique({ where: { id: listingId } });
    if (!listing) throw new NotFoundException('Listing not found');

    const quote = await this.quote({
      supplierCost: input.supplierCost,
      currency: input.currency,
      displayCurrency: input.displayCurrency ?? input.currency,
    });

    return this.prisma.listingPrice.upsert({
      where: { listingId },
      create: {
        listingId,
        supplierCost: input.supplierCost,
        displayPrice: quote.displayPrice,
        currency: input.displayCurrency ?? input.currency,
        priceType: input.priceType,
        fxRateApplied: quote.fxRateApplied,
        marginPercentApplied: quote.marginPercentApplied,
        flatFeeApplied: quote.flatFeeApplied,
      },
      update: {
        supplierCost: input.supplierCost,
        displayPrice: quote.displayPrice,
        currency: input.displayCurrency ?? input.currency,
        priceType: input.priceType,
        fxRateApplied: quote.fxRateApplied,
        marginPercentApplied: quote.marginPercentApplied,
        flatFeeApplied: quote.flatFeeApplied,
      },
    }).then(async (price) => {
      await this.audit.record({
        organizationId: listing.organizationId,
        entityType: 'ListingPrice',
        entityId: listingId,
        action: 'listing.price_set',
        metadata: {
          displayPrice: quote.displayPrice,
          currency: input.displayCurrency ?? input.currency,
          // never store raw supplierCost in notification; audit metadata keeps it internal
          hasSupplierCost: true,
        },
      });
      await this.notifications.enqueue({
        organizationId: listing.organizationId,
        type: 'listing.price_updated',
        title: 'Listing price updated',
        payload: { listingId, displayPrice: quote.displayPrice },
      });
      return price;
    });
  }

  toPublicPriceDto = toPublicPrice;
  toSellerPriceDto = toSellerPrice;

  private resolveFxRate(
    from: CurrencyCode,
    to: CurrencyCode,
    fxRates: Record<string, number> | null,
  ): number {
    if (from === to) return 1;
    const key = `${from}_${to}`;
    const rate = fxRates?.[key];
    if (rate == null || rate <= 0) {
      throw new NotFoundException(`FX rate not configured: ${key}`);
    }
    return rate;
  }
}
