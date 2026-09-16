import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FacilityType, OrgRole, PlatformRole } from '@prisma/client';
import { AuditService } from '../common/audit.service';
import { resolveIranPlace } from '../geo/iran-place';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateOrganizationDto,
  UpdateOrganizationCapabilitiesDto,
} from './dto/create-organization.dto';

@Injectable()
export class IdentityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async createOrganization(userId: string, dto: CreateOrganizationDto) {
    const slug = dto.slug.toLowerCase();
    const existing = await this.prisma.organization.findUnique({ where: { slug } });
    if (existing) throw new ConflictException('Organization slug already exists');

    const place = dto.location?.city ? resolveIranPlace(dto.location.city) : null;
    const city = place?.city || dto.location?.city || null;
    const province = place?.province || dto.location?.province || null;
    const countryCode = (dto.location?.countryCode || place?.countryCode || 'IR').toUpperCase();
    const latitude = dto.location?.latitude ?? place?.latitude ?? null;
    const longitude = dto.location?.longitude ?? place?.longitude ?? null;

    const org = await this.prisma.$transaction(async (tx) => {
      const created = await tx.organization.create({
        data: {
          name: dto.name,
          slug,
          canSell: dto.canSell ?? true,
          canBuy: dto.canBuy ?? true,
          isProfessional: dto.isProfessional ?? false,
          primarySpecialty: dto.primarySpecialty || null,
          members: {
            create: {
              userId,
              orgRole: OrgRole.ORG_OWNER,
            },
          },
        },
      });

      if (city) {
        const address = await tx.address.create({
          data: {
            countryCode,
            province: province || undefined,
            city,
            line1: dto.location?.line1 || city,
          },
        });

        let geoPointId: string | undefined;
        if (latitude != null && longitude != null) {
          const point = await tx.geoPoint.create({
            data: {
              latitude,
              longitude,
              accuracyM: place && dto.location?.latitude == null ? 5000 : undefined,
            },
          });
          geoPointId = point.id;
        }

        await tx.facility.create({
          data: {
            organizationId: created.id,
            name: dto.isProfessional ? `${dto.name} — محل خدمت` : `${dto.name} — انبار/نمایشگاه`,
            type: dto.isProfessional ? FacilityType.SERVICE_LOCATION : FacilityType.SHOWROOM,
            isPublicLocation: true,
            addressId: address.id,
            geoPointId,
          },
        });

        let centerPointId: string | undefined;
        if (latitude != null && longitude != null) {
          const center = await tx.geoPoint.create({
            data: { latitude, longitude, accuracyM: 5000 },
          });
          centerPointId = center.id;
        }

        await tx.serviceArea.create({
          data: {
            organizationId: created.id,
            name: province ? `${city}, ${province}` : city,
            countryCode,
            province: province || undefined,
            city,
            centerPointId,
            radiusKm: 40,
            isActive: true,
          },
        });
      }

      return tx.organization.findUniqueOrThrow({
        where: { id: created.id },
        include: {
          members: {
            where: { userId },
            select: { orgRole: true },
          },
          facilities: {
            include: { address: true, geoPoint: true },
            take: 3,
          },
          serviceAreas: true,
        },
      });
    });

    await this.audit.record({
      actorUserId: userId,
      organizationId: org.id,
      entityType: 'Organization',
      entityId: org.id,
      action: 'organization.created',
      metadata: {
        canSell: org.canSell,
        canBuy: org.canBuy,
        isProfessional: org.isProfessional,
        primarySpecialty: org.primarySpecialty,
        city,
        province,
        latitude,
        longitude,
      },
    });

    return org;
  }

  async listMyOrganizations(userId: string) {
    const memberships = await this.prisma.organizationMember.findMany({
      where: { userId },
      include: {
        organization: true,
      },
      orderBy: { createdAt: 'asc' },
    });
    return memberships.map((m) => ({
      orgRole: m.orgRole,
      organization: m.organization,
    }));
  }

  async getOrganization(userId: string, organizationId: string) {
    const membership = await this.prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: { userId, organizationId },
      },
      include: {
        organization: {
          include: {
            members: {
              select: {
                id: true,
                orgRole: true,
                user: { select: { id: true, email: true, fullName: true } },
              },
            },
          },
        },
      },
    });
    if (!membership) throw new NotFoundException('Organization not found');
    return membership.organization;
  }

  async updateCapabilities(
    actorUserId: string,
    organizationId: string,
    dto: UpdateOrganizationCapabilitiesDto,
    asPlatformAdmin = false,
  ) {
    if (!asPlatformAdmin) {
      await this.requireOrgAdmin(actorUserId, organizationId);
    }
    const org = await this.prisma.organization.update({
      where: { id: organizationId },
      data: {
        canSell: dto.canSell,
        canBuy: dto.canBuy,
        isProfessional: dto.isProfessional,
        isActive: dto.isActive,
        primarySpecialty: dto.primarySpecialty,
      },
    });
    await this.audit.record({
      actorUserId,
      organizationId,
      entityType: 'Organization',
      entityId: organizationId,
      action: 'organization.capabilities_updated',
      metadata: dto as Record<string, unknown>,
    });
    return org;
  }

  async addMember(
    actorUserId: string,
    organizationId: string,
    input: { email: string; orgRole: OrgRole },
  ) {
    await this.requireOrgAdmin(actorUserId, organizationId);
    const user = await this.prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
    });
    if (!user) throw new NotFoundException('User not found');

    try {
      return await this.prisma.organizationMember.create({
        data: {
          organizationId,
          userId: user.id,
          orgRole: input.orgRole,
        },
        include: {
          user: { select: { id: true, email: true, fullName: true } },
        },
      });
    } catch {
      throw new ConflictException('User is already a member');
    }
  }

  isPlatformAdmin(role: PlatformRole) {
    return role === PlatformRole.SUPER_ADMIN || role === PlatformRole.ADMIN;
  }

  private async requireOrgAdmin(userId: string, organizationId: string) {
    const membership = await this.prisma.organizationMember.findUnique({
      where: { userId_organizationId: { userId, organizationId } },
    });
    if (!membership) throw new ForbiddenException('Not a member');
    if (
      membership.orgRole !== OrgRole.ORG_OWNER &&
      membership.orgRole !== OrgRole.ORG_ADMIN
    ) {
      throw new ForbiddenException('Insufficient organization role');
    }
  }
}
