import { Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { NotificationService } from './notification.service';
import { OrgAccessService } from './org-access.service';
import { PlatformAdminGuard } from './platform-admin.guard';

@Module({
  providers: [OrgAccessService, PlatformAdminGuard, AuditService, NotificationService],
  exports: [OrgAccessService, PlatformAdminGuard, AuditService, NotificationService],
})
export class CommonModule {}
