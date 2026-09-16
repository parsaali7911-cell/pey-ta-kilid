import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PlatformAdminGuard } from '../common/platform-admin.guard';
import { SubmitPaymentDto } from './dto/submit-payment.dto';
import { OrderService } from './order.service';

type AuthUser = { userId: string };

@Controller()
@UseGuards(JwtAuthGuard)
export class OrderController {
  constructor(private readonly orders: OrderService) {}

  @Get('buyer/orders')
  listBuyer(
    @Req() req: { user: AuthUser },
    @Query('organizationId') organizationId: string,
  ) {
    return this.orders.listBuyerOrders(req.user.userId, organizationId);
  }

  @Get('buyer/orders/:id')
  getBuyer(@Req() req: { user: AuthUser }, @Param('id') id: string) {
    return this.orders.getBuyerOrder(req.user.userId, id);
  }

  @Get('seller/orders')
  listSeller(
    @Req() req: { user: AuthUser },
    @Query('organizationId') organizationId: string,
  ) {
    return this.orders.listSellerOrders(req.user.userId, organizationId);
  }

  @Get('seller/orders/:id')
  getSeller(@Req() req: { user: AuthUser }, @Param('id') id: string) {
    return this.orders.getSellerOrder(req.user.userId, id);
  }

  @Post('buyer/payments/submit')
  submitPayment(@Req() req: { user: AuthUser }, @Body() dto: SubmitPaymentDto) {
    return this.orders.submitPayment(req.user.userId, dto);
  }

  @Get('admin/payments/submitted')
  @UseGuards(PlatformAdminGuard)
  listSubmittedPayments() {
    return this.orders.listSubmittedPayments();
  }

  @Post('admin/payments/:id/confirm')
  @UseGuards(PlatformAdminGuard)
  confirmPayment(@Req() req: { user: AuthUser }, @Param('id') id: string) {
    return this.orders.confirmPayment(req.user.userId, id);
  }
}
