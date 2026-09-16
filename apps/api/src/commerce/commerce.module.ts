import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { ErpModule } from '../erp/erp.module';
import { InventoryModule } from '../inventory/inventory.module';
import { PrismaModule } from '../prisma/prisma.module';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';

@Module({
  imports: [PrismaModule, CommonModule, InventoryModule, ErpModule],
  controllers: [OrderController],
  providers: [OrderService],
  exports: [OrderService],
})
export class CommerceModule {}
