import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ListingStatus, Prisma, ProfessionalLeadStatus } from '@prisma/client';
import { OrgAccessService } from '../common/org-access.service';
import { haversineDistanceKm } from '../geo/geo.contracts';
import { resolveIranPlace, specialtyLabel } from '../geo/iran-place';
import { PrismaService } from '../prisma/prisma.service';

export type CreateProfessionalLeadInput = {
  locale?: string;
  contactName: string;
  contactEmail?: string | null;
  contactPhone?: string | null;
  specialtyHints?: string[];
  city?: string | null;
  countryCode?: string | null;
  notes?: string | null;
  sourceText?: string | null;
  projectId?: string | null;
  projectRequirementId?: string | null;
};

@Injectable()
export class ProfessionalLeadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orgAccess: OrgAccessService,
  ) {}

  async create(input: CreateProfessionalLeadInput) {
    const place = input.city ? resolveIranPlace(input.city) : null;
    const lead = await this.prisma.professionalLead.create({
      data: {
        locale: input.locale || 'fa',
        contactName: input.contactName,
        contactEmail: input.contactEmail || null,
        contactPhone: input.contactPhone || null,
        specialtyHints: input.specialtyHints || [],
        city: place?.city || input.city || null,
        countryCode: (input.countryCode || place?.countryCode || 'IR').toUpperCase(),
        notes: input.notes || null,
        sourceText: input.sourceText || null,
        status: ProfessionalLeadStatus.OPEN,
        projectId: input.projectId || null,
        projectRequirementId: input.projectRequirementId || null,
      },
    });
    if (input.projectRequirementId) {
      await this.prisma.projectRequirement
        .update({
          where: { id: input.projectRequirementId },
          data: {
            professionalLeadId: lead.id,
            status: 'SOURCING',
          },
        })
        .catch(() => null);
    }
    return this.toDto(lead);
  }

  async list(limit = 50) {
    const rows = await this.prisma.professionalLead.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        matchedOrganization: { select: { id: true, name: true, slug: true } },
      },
    });
    return rows.map((r) => this.toDto(r));
  }

  async getByPublicId(publicId: string) {
    const lead = await this.prisma.professionalLead.findUnique({
      where: { publicId },
      include: {
        matchedOrganization: { select: { id: true, name: true, slug: true } },
      },
    });
    if (!lead) throw new NotFoundException('Lead not found');
    return this.toDto(lead);
  }

  /** Leads relevant to a professional org: open matches + claimed by this org. */
  async listForOrganization(userId: string, organizationId: string, limit = 40) {
    await this.orgAccess.requireSellerMember(userId, organizationId);
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        isProfessional: true,
        primarySpecialty: true,
        facilities: {
          where: { status: 'ACTIVE', isPublicLocation: true },
          select: {
            address: { select: { city: true, province: true } },
          },
        },
        serviceAreas: {
          where: { isActive: true },
          select: { city: true, province: true },
        },
      },
    });
    if (!org) throw new NotFoundException('Organization not found');
    if (!org.isProfessional) {
      throw new BadRequestException('Organization is not professional');
    }

    const cities = new Set<string>();
    const provinces = new Set<string>();
    for (const f of org.facilities) {
      if (f.address.city) cities.add(f.address.city.toLowerCase());
      if (f.address.province) provinces.add(f.address.province.toLowerCase());
    }
    for (const a of org.serviceAreas) {
      if (a.city) cities.add(a.city.toLowerCase());
      if (a.province) provinces.add(a.province.toLowerCase());
    }

    const rows = await this.prisma.professionalLead.findMany({
      where: {
        OR: [
          { matchedOrganizationId: organizationId },
          {
            status: ProfessionalLeadStatus.OPEN,
            ...(org.primarySpecialty
              ? {
                  OR: [
                    { specialtyHints: { isEmpty: true } },
                    { specialtyHints: { has: org.primarySpecialty } },
                  ],
                }
              : {}),
          },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 120,
      include: {
        matchedOrganization: { select: { id: true, name: true, slug: true } },
      },
    });

    const filtered = rows.filter((lead) => {
      if (lead.matchedOrganizationId === organizationId) return true;
      if (lead.status !== ProfessionalLeadStatus.OPEN) return false;
      if (!lead.city) return true;
      if (!cities.size && !provinces.size) return true;
      const needle = lead.city.toLowerCase();
      const place = resolveIranPlace(lead.city);
      const placeCity = (place?.city || '').toLowerCase();
      const placeProvince = (place?.province || '').toLowerCase();
      for (const c of cities) {
        if (c.includes(needle) || needle.includes(c)) return true;
        if (placeCity && (c.includes(placeCity) || placeCity.includes(c))) return true;
      }
      for (const p of provinces) {
        if (placeProvince && (p.includes(placeProvince) || placeProvince.includes(p))) return true;
        if (p.includes(needle) || needle.includes(p)) return true;
      }
      return false;
    });

    return filtered.slice(0, limit).map((r) => this.toDto(r));
  }

  async claim(userId: string, organizationId: string, publicId: string) {
    await this.orgAccess.requireSellerWriter(userId, organizationId);
    const org = await this.prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org?.isProfessional) throw new BadRequestException('Organization is not professional');

    const lead = await this.prisma.professionalLead.findUnique({ where: { publicId } });
    if (!lead) throw new NotFoundException('Lead not found');
    if (lead.status === ProfessionalLeadStatus.CLOSED) {
      throw new BadRequestException('Lead is closed');
    }
    if (
      lead.status === ProfessionalLeadStatus.MATCHED &&
      lead.matchedOrganizationId &&
      lead.matchedOrganizationId !== organizationId
    ) {
      throw new ForbiddenException('Lead already claimed by another organization');
    }

    const updated = await this.prisma.professionalLead.update({
      where: { publicId },
      data: {
        status: ProfessionalLeadStatus.MATCHED,
        matchedOrganizationId: organizationId,
        matchedAt: lead.matchedAt || new Date(),
      },
      include: {
        matchedOrganization: { select: { id: true, name: true, slug: true } },
      },
    });
    return this.toDto(updated);
  }

  async close(userId: string, organizationId: string, publicId: string) {
    await this.orgAccess.requireSellerWriter(userId, organizationId);
    const lead = await this.prisma.professionalLead.findUnique({ where: { publicId } });
    if (!lead) throw new NotFoundException('Lead not found');
    if (lead.matchedOrganizationId && lead.matchedOrganizationId !== organizationId) {
      throw new ForbiddenException('Lead belongs to another organization');
    }
    if (!lead.matchedOrganizationId) {
      // Allow closing an open lead only after claiming, or claim+close in one step.
      await this.claim(userId, organizationId, publicId);
    }
    const updated = await this.prisma.professionalLead.update({
      where: { publicId },
      data: { status: ProfessionalLeadStatus.CLOSED },
      include: {
        matchedOrganization: { select: { id: true, name: true, slug: true } },
      },
    });
    return this.toDto(updated);
  }

  async listProfessionalOrgs(
    locale = 'fa',
    filters?: {
      city?: string;
      province?: string;
      specialty?: string;
      lat?: number;
      lng?: number;
      radiusKm?: number;
      includeSellers?: boolean;
    },
  ) {
    const place = filters?.city ? resolveIranPlace(filters.city) : null;
    const cityNeedle = (place?.city || filters?.city || '').toLowerCase();
    const provinceNeedle = (place?.province || filters?.province || '').toLowerCase();
    const specialty = filters?.specialty || undefined;
    const origin =
      filters?.lat != null && filters?.lng != null
        ? { latitude: filters.lat, longitude: filters.lng }
        : place
          ? { latitude: place.latitude, longitude: place.longitude }
          : null;
    const radiusKm = filters?.radiusKm ?? 80;

    const where: Prisma.OrganizationWhereInput = {
      isActive: true,
      OR: filters?.includeSellers
        ? [{ isProfessional: true }, { canSell: true }]
        : [{ isProfessional: true }],
      ...(specialty ? { primarySpecialty: specialty } : {}),
    };

    const orgs = await this.prisma.organization.findMany({
      where,
      select: {
        id: true,
        name: true,
        slug: true,
        canSell: true,
        isProfessional: true,
        primarySpecialty: true,
        seoTitle: true,
        professionalProfile: {
          select: {
            profileScore: true,
            avatarUrl: true,
            identityVerifiedAt: true,
            mobileVerifiedAt: true,
            reviewCount: true,
            ratingAvg: true,
            displayName: true,
          },
        },
        facilities: {
          where: { status: 'ACTIVE', isPublicLocation: true },
          take: 5,
          select: {
            name: true,
            type: true,
            address: { select: { city: true, province: true, countryCode: true } },
            geoPoint: { select: { latitude: true, longitude: true } },
          },
        },
        serviceAreas: {
          where: { isActive: true },
          take: 5,
          select: {
            city: true,
            province: true,
            countryCode: true,
            radiusKm: true,
            centerPoint: { select: { latitude: true, longitude: true } },
          },
        },
      },
      take: 120,
      orderBy: { createdAt: 'desc' },
    });

    const mapped = orgs.map((o) => {
      const locations = o.facilities.map((f) => {
        const lat = f.geoPoint ? Number(f.geoPoint.latitude) : null;
        const lng = f.geoPoint ? Number(f.geoPoint.longitude) : null;
        const distanceKm =
          origin && lat != null && lng != null
            ? haversineDistanceKm(origin, { latitude: lat, longitude: lng })
            : null;
        return {
          name: f.name,
          type: f.type,
          city: f.address.city,
          province: f.address.province,
          countryCode: f.address.countryCode,
          latitude: lat,
          longitude: lng,
          distanceKm,
        };
      });

      const areas = o.serviceAreas.map((a) => ({
        city: a.city,
        province: a.province,
        countryCode: a.countryCode,
        radiusKm: a.radiusKm != null ? Number(a.radiusKm) : null,
        latitude: a.centerPoint ? Number(a.centerPoint.latitude) : null,
        longitude: a.centerPoint ? Number(a.centerPoint.longitude) : null,
      }));

      const bestDistance = locations
        .map((l) => l.distanceKm)
        .filter((d): d is number => d != null)
        .sort((a, b) => a - b)[0];

      return {
        id: o.id,
        name: o.professionalProfile?.displayName || o.name,
        slug: o.slug,
        canSell: o.canSell,
        isProfessional: o.isProfessional,
        specialty: o.primarySpecialty,
        specialtyLabel: specialtyLabel(o.primarySpecialty, locale),
        profileScore: o.professionalProfile?.profileScore ?? 0,
        avatarUrl: o.professionalProfile?.avatarUrl ?? null,
        identityVerified: Boolean(o.professionalProfile?.identityVerifiedAt),
        mobileVerified: Boolean(o.professionalProfile?.mobileVerifiedAt),
        reviewCount: o.professionalProfile?.reviewCount ?? 0,
        ratingAvg: o.professionalProfile?.ratingAvg ?? null,
        locations,
        serviceAreas: areas,
        distanceKm: bestDistance ?? null,
      };
    });

    return mapped
      .filter((o) => {
        if (specialty && o.specialty && o.specialty !== specialty) return false;
        if (!cityNeedle && !provinceNeedle && !origin) return true;
        const locHit = o.locations.some((l) => {
          const c = (l.city || '').toLowerCase();
          const p = (l.province || '').toLowerCase();
          if (cityNeedle && (c.includes(cityNeedle) || cityNeedle.includes(c))) return true;
          if (provinceNeedle && (p.includes(provinceNeedle) || provinceNeedle.includes(p))) return true;
          if (origin && l.distanceKm != null && l.distanceKm <= radiusKm) return true;
          return false;
        });
        const areaHit = o.serviceAreas.some((a) => {
          const c = (a.city || '').toLowerCase();
          const p = (a.province || '').toLowerCase();
          if (cityNeedle && c && (c.includes(cityNeedle) || cityNeedle.includes(c))) return true;
          if (provinceNeedle && p && (p.includes(provinceNeedle) || provinceNeedle.includes(p))) {
            return true;
          }
          return false;
        });
        return locHit || areaHit;
      })
      .sort((a, b) => {
        const scoreDiff = (b.profileScore || 0) - (a.profileScore || 0);
        if (Math.abs(scoreDiff) >= 5) return scoreDiff;
        if (a.distanceKm == null && b.distanceKm == null) return scoreDiff;
        if (a.distanceKm == null) return 1;
        if (b.distanceKm == null) return -1;
        const dist = a.distanceKm - b.distanceKm;
        return dist !== 0 ? dist : scoreDiff;
      })
      .slice(0, 60);
  }

  async listPublishedServiceListings(limit = 24) {
    const rows = await this.prisma.listing.findMany({
      where: {
        status: ListingStatus.PUBLISHED,
        organization: { isProfessional: true, isActive: true },
      },
      select: {
        publicId: true,
        slug: true,
        title: true,
        organization: { select: { name: true, slug: true, primarySpecialty: true } },
        facility: {
          select: {
            address: { select: { city: true, province: true, countryCode: true } },
            geoPoint: { select: { latitude: true, longitude: true } },
          },
        },
      },
      take: limit,
      orderBy: { publishedAt: 'desc' },
    });
    return rows.map((r) => ({
      ...r,
      facility: r.facility
        ? {
            ...r.facility,
            geoPoint: r.facility.geoPoint
              ? {
                  latitude: Number(r.facility.geoPoint.latitude),
                  longitude: Number(r.facility.geoPoint.longitude),
                }
              : null,
          }
        : null,
    }));
  }

  private toDto(lead: {
    publicId: string;
    createdAt: Date;
    locale: string;
    contactName: string;
    contactEmail: string | null;
    contactPhone: string | null;
    specialtyHints: string[];
    city: string | null;
    countryCode: string | null;
    notes: string | null;
    sourceText: string | null;
    status: ProfessionalLeadStatus;
    matchedOrganizationId?: string | null;
    matchedAt?: Date | null;
    matchedOrganization?: { id: string; name: string; slug: string } | null;
  }) {
    return {
      publicId: lead.publicId,
      createdAt: lead.createdAt.getTime?.() ?? Number(lead.createdAt),
      locale: lead.locale,
      contactName: lead.contactName,
      contactEmail: lead.contactEmail,
      contactPhone: lead.contactPhone,
      specialtyHints: lead.specialtyHints || [],
      city: lead.city,
      countryCode: lead.countryCode,
      notes: lead.notes,
      sourceText: lead.sourceText,
      status: lead.status,
      matchedOrganizationId: lead.matchedOrganizationId ?? null,
      matchedAt: lead.matchedAt ? lead.matchedAt.getTime() : null,
      matchedOrganization: lead.matchedOrganization ?? null,
    };
  }
}
