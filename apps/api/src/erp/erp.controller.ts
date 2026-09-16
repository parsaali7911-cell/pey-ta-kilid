import { Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PlatformAdminGuard } from '../common/platform-admin.guard';
import { ErpOutboxService } from './erp-outbox.service';

@Controller('admin/erp')
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class ErpController {
  constructor(private readonly outbox: ErpOutboxService) {}

  @Post('outbox/process')
  processOutbox() {
    return this.outbox.pollPending();
  }
}
