import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PlatformAdminGuard } from '../common/platform-admin.guard';
import { PrismaService } from '../prisma/prisma.service';
import {
  InventoryAdjustDto,
  InventoryQtyDto,
  ReserveDto,
} from '../pricing/dto/pricing-inventory.dto';
import { InventoryService } from './inventory.service';

@Controller()
export class InventoryController {
  constructor(
    private readonly inventory: InventoryService,
    private readonly prisma: PrismaService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get('seller/listings/:id/inventory')
  getBalance(@Param('id') id: string) {
    return this.inventory.getBalance(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('seller/listings/:id/inventory/in')
  stockIn(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string,
    @Body() dto: InventoryQtyDto,
  ) {
    return this.inventory.stockIn(req.user.userId, id, dto.quantity, dto.note);
  }

  @UseGuards(JwtAuthGuard)
  @Post('seller/listings/:id/inventory/out')
  stockOut(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string,
    @Body() dto: InventoryQtyDto,
  ) {
    return this.inventory.stockOut(req.user.userId, id, dto.quantity, dto.note);
  }

  @UseGuards(JwtAuthGuard)
  @Post('seller/listings/:id/inventory/adjust')
  adjust(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string,
    @Body() dto: InventoryAdjustDto,
  ) {
    return this.inventory.adjust(req.user.userId, id, dto.quantityDelta, dto.note);
  }

  @UseGuards(JwtAuthGuard)
  @Post('seller/listings/:id/inventory/reserve')
  reserve(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string,
    @Body() dto: ReserveDto,
  ) {
    return this.inventory.reserve(
      req.user.userId,
      id,
      dto.quantity,
      dto.expiresAt ? new Date(dto.expiresAt) : undefined,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('seller/inventory/reservations/:id/release')
  release(@Req() req: { user: { userId: string } }, @Param('id') id: string) {
    return this.inventory.release(req.user.userId, id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('uom/convert')
  async convert(
    @Query('quantity') quantity: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    const q = Number(quantity);
    const dbFactor = await this.inventory.resolveConversionFactor(from, to);
    return {
      from,
      to,
      quantity: q,
      converted: this.inventory.convertQuantity(q, from, to, dbFactor),
    };
  }

  @UseGuards(JwtAuthGuard, PlatformAdminGuard)
  @Post('admin/uom/conversions')
  upsertConversion(
    @Body() body: { fromUom: string; toUom: string; factor: number },
  ) {
    return this.prisma.unitConversion.upsert({
      where: { fromUom_toUom: { fromUom: body.fromUom, toUom: body.toUom } },
      create: { fromUom: body.fromUom, toUom: body.toUom, factor: body.factor },
      update: { factor: body.factor, isActive: true },
    });
  }
}
