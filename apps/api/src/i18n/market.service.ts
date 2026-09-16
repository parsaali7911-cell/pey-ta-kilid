import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CurrencyCode, MarketCode, PriceType, Prisma } from '@prisma/client';
import { INCOTERM_CODES, SUPPORTED_CURRENCY_CODES } from '@peytakilid/shared-types';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MarketService {
  constructor(private readonly prisma: PrismaService) {}

  listMarkets() {
    return this.prisma.market.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
    });
  }

  async getMarket(code: MarketCode) {
    const market = await this.prisma.market.findUnique({ where: { code } });
    if (!market || !market.isActive) throw new NotFoundException('Market not found');
    return this.toDto(market);
  }

  assertCurrencyAllowed(market: { allowedCurrencies: unknown }, currency: CurrencyCode) {
    const allowed = Array.isArray(market.allowedCurrencies)
      ? (market.allowedCurrencies as string[])
      : [];
    if (!allowed.includes(currency)) {
      throw new BadRequestException(`Currency ${currency} not allowed for market`);
    }
  }

  assertIncotermAllowed(market: { allowedIncoterms: unknown }, incoterm: PriceType) {
    const allowed = Array.isArray(market.allowedIncoterms)
      ? (market.allowedIncoterms as string[])
      : [];
    if (!allowed.includes(incoterm)) {
      throw new BadRequestException(`Incoterm ${incoterm} not allowed for market`);
    }
  }

  commercialFoundations() {
    return {
      currencies: SUPPORTED_CURRENCY_CODES,
      incoterms: INCOTERM_CODES,
      note: 'Foundations only — RFQ/Quote engine not implemented in Phase 0-D',
    };
  }

  private toDto(market: {
    code: MarketCode;
    nameEn: string;
    isActive: boolean;
    defaultCurrency: CurrencyCode;
    allowedCurrencies: Prisma.JsonValue;
    allowedIncoterms: Prisma.JsonValue;
    sortOrder: number;
  }) {
    return {
      code: market.code,
      nameEn: market.nameEn,
      isActive: market.isActive,
      defaultCurrency: market.defaultCurrency,
      allowedCurrencies: market.allowedCurrencies,
      allowedIncoterms: market.allowedIncoterms,
      sortOrder: market.sortOrder,
    };
  }
}
