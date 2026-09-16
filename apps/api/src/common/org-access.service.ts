import { ForbiddenException, Injectable } from '@nestjs/common';
import { OrgRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const WRITE_ROLES: OrgRole[] = [OrgRole.ORG_OWNER, OrgRole.ORG_ADMIN, OrgRole.ORG_STAFF];

export type OrgCapability = 'canSell' | 'canBuy' | 'isProfessional';

@Injectable()
export class OrgAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async requireMember(userId: string, organizationId: string) {
    const membership = await this.prisma.organizationMember.findUnique({
      where: { userId_organizationId: { userId, organizationId } },
      include: { organization: true },
    });
    if (!membership) throw new ForbiddenException('Not an organization member');
    if (!membership.organization.isActive) {
      throw new ForbiddenException('Organization is inactive');
    }
    return membership;
  }

  async requireWriter(userId: string, organizationId: string) {
    const membership = await this.requireMember(userId, organizationId);
    if (!WRITE_ROLES.includes(membership.orgRole)) {
      throw new ForbiddenException('Insufficient organization role');
    }
    return membership;
  }

  async requireCapability(organizationId: string, capability: OrgCapability) {
    const org = await this.prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org || !org.isActive) throw new ForbiddenException('Organization not available');
    if (!org[capability]) {
      throw new ForbiddenException(`Organization lacks capability: ${capability}`);
    }
    return org;
  }

  async requireSellerWriter(userId: string, organizationId: string) {
    const membership = await this.requireWriter(userId, organizationId);
    await this.requireCapability(organizationId, 'canSell');
    return membership;
  }

  async requireSellerMember(userId: string, organizationId: string) {
    const membership = await this.requireMember(userId, organizationId);
    await this.requireCapability(organizationId, 'canSell');
    return membership;
  }

  async requireBuyerWriter(userId: string, organizationId: string) {
    const membership = await this.requireWriter(userId, organizationId);
    await this.requireCapability(organizationId, 'canBuy');
    return membership;
  }

  async requireBuyerMember(userId: string, organizationId: string) {
    const membership = await this.requireMember(userId, organizationId);
    await this.requireCapability(organizationId, 'canBuy');
    return membership;
  }
}
