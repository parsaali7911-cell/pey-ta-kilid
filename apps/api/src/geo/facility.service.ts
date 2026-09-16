import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FacilityStatus } from '@prisma/client';
import { AuditService } from '../common/audit.service';
import { OrgAccessService } from '../common/org-access.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateFacilityDto,
  CreateServiceAreaDto,
  UpdateFacilityDto,
} from './dto/facility.dto';
import { toSellerFacility } from './geo.contracts';
import { GeoService } from './geo.service';
import { resolveIranPlace } from './iran-place';

@Injectable()
export class FacilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orgAccess: OrgAccessService,
    private readonly geo: GeoService,
    private readonly audit: AuditService,
  ) {}

  async create(userId: string, dto: CreateFacilityDto) {
    await this.orgAccess.requireSellerWriter(userId, dto.organizationId);
    const countryCode = this.geo.validateCountryCode(dto.address.countryCode);
    if (dto.geoPoint) {
      this.geo.validateCoordinates(dto.geoPoint.latitude, dto.geoPoint.longitude);
    }

    // Fill missing coordinates from Iran city lexicon so sellers/pros are matchable.
    const place = resolveIranPlace(dto.address.city);
    const geoPoint =
      dto.geoPoint ||
      (place
        ? { latitude: place.latitude, longitude: place.longitude, accuracyM: 5000 }
        : undefined);
    const province = dto.address.province || place?.province || undefined;
    const city = place?.city || dto.address.city;

    const facility = await this.prisma.$transaction(async (tx) => {
      const address = await tx.address.create({
        data: {
          countryCode,
          region: dto.address.region,
          province,
          city,
          line1: dto.address.line1,
          line2: dto.address.line2,
          postalCode: dto.address.postalCode,
        },
      });

      let geoPointId: string | undefined;
      if (geoPoint) {
        this.geo.validateCoordinates(geoPoint.latitude, geoPoint.longitude);
        const point = await tx.geoPoint.create({
          data: {
            latitude: geoPoint.latitude,
            longitude: geoPoint.longitude,
            accuracyM: geoPoint.accuracyM,
          },
        });
        geoPointId = point.id;
      }

      return tx.facility.create({
        data: {
          organizationId: dto.organizationId,
          name: dto.name,
          type: dto.type,
          status: dto.status ?? FacilityStatus.ACTIVE,
          isPublicLocation: dto.isPublicLocation ?? true,
          addressId: address.id,
          geoPointId,
        },
        include: { address: true, geoPoint: true },
      });
    });

    await this.audit.record({
      actorUserId: userId,
      organizationId: dto.organizationId,
      entityType: 'Facility',
      entityId: facility.id,
      action: 'facility.created',
    });

    return toSellerFacility(facility);
  }

  async update(userId: string, facilityId: string, dto: UpdateFacilityDto) {
    const existing = await this.prisma.facility.findUnique({
      where: { id: facilityId },
      include: { address: true, geoPoint: true },
    });
    if (!existing) throw new NotFoundException('Facility not found');
    await this.orgAccess.requireSellerWriter(userId, existing.organizationId);

    if (dto.address?.countryCode) {
      this.geo.validateCountryCode(dto.address.countryCode);
    }
    if (dto.geoPoint) {
      this.geo.validateCoordinates(dto.geoPoint.latitude, dto.geoPoint.longitude);
    }

    const facility = await this.prisma.$transaction(async (tx) => {
      if (dto.address) {
        await tx.address.update({
          where: { id: existing.addressId },
          data: {
            countryCode: dto.address.countryCode
              ? this.geo.validateCountryCode(dto.address.countryCode)
              : undefined,
            region: dto.address.region,
            province: dto.address.province,
            city: dto.address.city,
            line1: dto.address.line1,
            line2: dto.address.line2,
            postalCode: dto.address.postalCode,
          },
        });
      }

      let geoPointId: string | null = existing.geoPointId;
      if (dto.geoPoint === null) {
        geoPointId = null;
      } else if (dto.geoPoint) {
        if (existing.geoPointId) {
          await tx.geoPoint.update({
            where: { id: existing.geoPointId },
            data: {
              latitude: dto.geoPoint.latitude,
              longitude: dto.geoPoint.longitude,
              accuracyM: dto.geoPoint.accuracyM,
            },
          });
        } else {
          const point = await tx.geoPoint.create({
            data: {
              latitude: dto.geoPoint.latitude,
              longitude: dto.geoPoint.longitude,
              accuracyM: dto.geoPoint.accuracyM,
            },
          });
          geoPointId = point.id;
        }
      }

      return tx.facility.update({
        where: { id: facilityId },
        data: {
          name: dto.name,
          type: dto.type,
          status: dto.status,
          isPublicLocation: dto.isPublicLocation,
          geoPointId,
        },
        include: { address: true, geoPoint: true },
      });
    });

    await this.audit.record({
      actorUserId: userId,
      organizationId: existing.organizationId,
      entityType: 'Facility',
      entityId: facilityId,
      action: 'facility.updated',
    });

    return toSellerFacility(facility);
  }

  async listForOrg(userId: string, organizationId: string) {
    await this.orgAccess.requireSellerMember(userId, organizationId);
    const rows = await this.prisma.facility.findMany({
      where: { organizationId },
      include: { address: true, geoPoint: true },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => toSellerFacility(r));
  }

  async getForOrg(userId: string, facilityId: string) {
    const facility = await this.prisma.facility.findUnique({
      where: { id: facilityId },
      include: { address: true, geoPoint: true },
    });
    if (!facility) throw new NotFoundException('Facility not found');
    await this.orgAccess.requireSellerMember(userId, facility.organizationId);
    return toSellerFacility(facility);
  }

  async assertFacilityOwnedByOrg(facilityId: string, organizationId: string) {
    const facility = await this.prisma.facility.findUnique({ where: { id: facilityId } });
    if (!facility || facility.organizationId !== organizationId) {
      throw new BadRequestException('facilityId must belong to the listing organization');
    }
    if (facility.status !== FacilityStatus.ACTIVE) {
      throw new BadRequestException('Facility must be ACTIVE');
    }
    return facility;
  }

  async createServiceArea(userId: string, dto: CreateServiceAreaDto) {
    await this.orgAccess.requireSellerWriter(userId, dto.organizationId);
    if (dto.countryCode) this.geo.validateCountryCode(dto.countryCode);
    if (dto.centerPoint) {
      this.geo.validateCoordinates(dto.centerPoint.latitude, dto.centerPoint.longitude);
    }

    return this.prisma.$transaction(async (tx) => {
      let centerPointId: string | undefined;
      if (dto.centerPoint) {
        const point = await tx.geoPoint.create({
          data: {
            latitude: dto.centerPoint.latitude,
            longitude: dto.centerPoint.longitude,
            accuracyM: dto.centerPoint.accuracyM,
          },
        });
        centerPointId = point.id;
      }
      return tx.serviceArea.create({
        data: {
          organizationId: dto.organizationId,
          name: dto.name,
          countryCode: dto.countryCode
            ? this.geo.validateCountryCode(dto.countryCode)
            : undefined,
          region: dto.region,
          province: dto.province,
          city: dto.city,
          centerPointId,
          radiusKm: dto.radiusKm,
        },
        include: { centerPoint: true },
      });
    });
  }

  listServiceAreas(userId: string, organizationId: string) {
    return this.orgAccess.requireSellerMember(userId, organizationId).then(() =>
      this.prisma.serviceArea.findMany({
        where: { organizationId, isActive: true },
        include: { centerPoint: true },
        orderBy: { createdAt: 'asc' },
      }),
    );
  }
}
