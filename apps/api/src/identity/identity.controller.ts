import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { OrgRole, PlatformRole } from '@prisma/client';
import { IsEmail, IsEnum } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PlatformAdminGuard } from '../common/platform-admin.guard';
import {
  CreateOrganizationDto,
  UpdateOrganizationCapabilitiesDto,
} from './dto/create-organization.dto';
import { IdentityService } from './identity.service';

class AddMemberDto {
  @IsEmail()
  email!: string;

  @IsEnum(OrgRole)
  orgRole!: OrgRole;
}

@Controller()
export class IdentityController {
  constructor(private readonly identity: IdentityService) {}

  @UseGuards(JwtAuthGuard)
  @Post('organizations')
  create(
    @Req() req: { user: { userId: string } },
    @Body() dto: CreateOrganizationDto,
  ) {
    return this.identity.createOrganization(req.user.userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('organizations')
  listMine(@Req() req: { user: { userId: string } }) {
    return this.identity.listMyOrganizations(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('organizations/:id')
  getOne(@Req() req: { user: { userId: string } }, @Param('id') id: string) {
    return this.identity.getOrganization(req.user.userId, id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('organizations/:id/capabilities')
  updateCapabilities(
    @Req() req: { user: { userId: string; platformRole: PlatformRole } },
    @Param('id') id: string,
    @Body() dto: UpdateOrganizationCapabilitiesDto,
  ) {
    const asAdmin = this.identity.isPlatformAdmin(req.user.platformRole);
    return this.identity.updateCapabilities(req.user.userId, id, dto, asAdmin);
  }

  @UseGuards(JwtAuthGuard)
  @Post('organizations/:id/members')
  addMember(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string,
    @Body() dto: AddMemberDto,
  ) {
    return this.identity.addMember(req.user.userId, id, dto);
  }

  @UseGuards(JwtAuthGuard, PlatformAdminGuard)
  @Patch('admin/organizations/:id/capabilities')
  adminUpdateCapabilities(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string,
    @Body() dto: UpdateOrganizationCapabilitiesDto,
  ) {
    return this.identity.updateCapabilities(req.user.userId, id, dto, true);
  }
}
