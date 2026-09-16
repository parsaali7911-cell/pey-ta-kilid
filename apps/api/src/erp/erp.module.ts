import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ErpOutboxService } from './erp-outbox.service';
import { ErpController } from './erp.controller';
import { createErpProvider } from './provider/erp-provider.factory';
import { ERP_PROVIDER } from './provider/erp-provider.interface';

@Module({
  imports: [PrismaModule],
  controllers: [ErpController],
  providers: [
    {
      provide: ERP_PROVIDER,
      useFactory: () => createErpProvider(),
    },
    ErpOutboxService,
  ],
  exports: [ErpOutboxService, ERP_PROVIDER],
})
export class ErpModule {}
