import { randomUUID } from 'crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { ListingStatus, Prisma } from '@prisma/client';
import { haversineDistanceKm } from '../geo/geo.contracts';
import { resolveIranPlace, specialtyLabel } from '../geo/iran-place';
import { PrismaService } from '../prisma/prisma.service';

export type ProfessionalLead = {
  publicId: string;
  createdAt: number;
  locale: string;
  contactName: string;
  contactEmail?: string | null;
  contactPhone?: string | null;
  specialtyHints: string[];
  city?: string | null;
  countryCode?: string | null;
  notes?: string | null;
  sourceText?: string | null;
  status: 'OPEN' | 'MATCHED' | 'CLOSED';
};

const leads = new Map<string, ProfessionalLead>();

@Injectable()
export class ProfessionalLeadsService {
  constructor(private readonly prisma: PrismaService) {}

  create(input: Omit<ProfessionalLead, 'publicId' | 'createdAt' | 'status'> & { status?: ProfessionalLead['status'] }) {
    const publicId = randomUUID();
    const lead: ProfessionalLead = {
      publicId,
      createdAt: Date.now(),
      locale: input.locale || 'fa',
      contactName: input.contactName,
      contactEmail: input.contactEmail || null,
      contactPhone: input.contactPhone || null,
      specialtyHints: input.specialtyHints || [],
      city: input.city || null,
      countryCode: input.countryCode || null,
      notes: input.notes || null,
      sourceText: input.sourceText || null,
      status: input.status || 'OPEN',
    };
    leads.set(publicId, lead);
    return lead;
  }

  list(limit = 50) {
    return [...leads.values()]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit);
  }

  get(publicId: string) {
    const lead = leads.get(publicId);
    if (!lead) throw new NotFoundException('Lead not found');
    return lead;
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
        name: o.name,
        slug: o.slug,
        canSell: o.canSell,
        isProfessional: o.isProfessional,
        specialty: o.primarySpecialty,
        specialtyLabel: specialtyLabel(o.primarySpecialty, locale),
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
          if (provinceNeedle && p && (p.includes(provinceNeedle) || provinceNeedle.includes(p))) return true;
          return false;
        });
        return locHit || areaHit || (!o.locations.length && !o.serviceAreas.length ? false : false);
      })
      .sort((a, b) => {
        if (a.distanceKm == null && b.distanceKm == null) return 0;
        if (a.distanceKm == null) return 1;
        if (b.distanceKm == null) return -1;
        return a.distanceKm - b.distanceKm;
      })
      .slice(0, 60);
  }

  /** Public directory of published professional-adjacent orgs that can sell services. */
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
}
