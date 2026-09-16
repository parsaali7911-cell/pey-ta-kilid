import { randomInt } from 'crypto';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FacilityType, OrgRole, ProfessionalReviewStatus } from '@prisma/client';
import { OrgAccessService } from '../common/org-access.service';
import { resolveIranPlace, specialtyLabel } from '../geo/iran-place';
import { PrismaService } from '../prisma/prisma.service';
import { SeoContentService } from '../seo/seo-content.service';
import {
  computeProfessionalProfileScore,
  hashNationalId,
  hashOtpCode,
  isValidIranianNationalId,
  normalizeIranMobile,
  slugifyProName,
} from './professional-profile.score';

const UPLOAD_ROOT = join(process.cwd(), 'uploads', 'professionals');

export type UpdateProProfileInput = {
  displayName?: string;
  bio?: string;
  yearsExperience?: number | null;
  secondarySpecialties?: string[];
  projectTypes?: string[];
  serviceRadiusKm?: number | null;
  priceRangeMin?: number | null;
  priceRangeMax?: number | null;
  priceCurrency?: string | null;
  priceNote?: string | null;
  availabilityNote?: string | null;
  primarySpecialty?: string | null;
  city?: string | null;
};

@Injectable()
export class ProfessionalProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orgAccess: OrgAccessService,
    private readonly seoContent: SeoContentService,
  ) {}

  async ensureProfile(organizationId: string) {
    const org = await this.prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org?.isProfessional) throw new BadRequestException('Organization is not professional');
    const existing = await this.prisma.professionalProfile.findUnique({
      where: { organizationId },
    });
    if (existing) return existing;
    return this.prisma.professionalProfile.create({
      data: {
        organizationId,
        displayName: org.name,
      },
    });
  }

  async getPublicBySlug(slug: string, locale = 'fa') {
    const org = await this.prisma.organization.findFirst({
      where: { slug, isActive: true, isProfessional: true },
      include: {
        professionalProfile: { include: { portfolio: { orderBy: { sortOrder: 'asc' } } } },
        facilities: {
          where: { isPublicLocation: true, status: 'ACTIVE' },
          take: 3,
          include: { address: true, geoPoint: true },
        },
        serviceAreas: { where: { isActive: true }, take: 5 },
      },
    });
    if (!org) throw new NotFoundException('Professional not found');
    const profile = org.professionalProfile;
    const reviews = await this.prisma.professionalReview.findMany({
      where: { organizationId: org.id, status: ProfessionalReviewStatus.APPROVED },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: {
        publicId: true,
        authorName: true,
        rating: true,
        body: true,
        createdAt: true,
      },
    });

    return {
      id: org.id,
      slug: org.slug,
      name: org.name,
      seoTitle: org.seoTitle,
      seoDescription: org.seoDescription,
      specialty: org.primarySpecialty,
      specialtyLabel: specialtyLabel(org.primarySpecialty, locale),
      profile: profile
        ? {
            displayName: profile.displayName || org.name,
            bio: profile.bio,
            yearsExperience: profile.yearsExperience,
            avatarUrl: profile.avatarUrl,
            secondarySpecialties: profile.secondarySpecialties,
            secondarySpecialtyLabels: profile.secondarySpecialties.map((c) =>
              specialtyLabel(c, locale),
            ),
            projectTypes: profile.projectTypes,
            serviceRadiusKm: profile.serviceRadiusKm,
            priceRangeMin: profile.priceRangeMin != null ? Number(profile.priceRangeMin) : null,
            priceRangeMax: profile.priceRangeMax != null ? Number(profile.priceRangeMax) : null,
            priceCurrency: profile.priceCurrency,
            priceNote: profile.priceNote,
            availabilityNote: profile.availabilityNote,
            profileScore: profile.profileScore,
            portfolioCount: profile.portfolioCount,
            reviewCount: profile.reviewCount,
            ratingAvg: profile.ratingAvg,
            mobileVerified: Boolean(profile.mobileVerifiedAt),
            identityVerified: Boolean(profile.identityVerifiedAt),
            nationalIdLast4: profile.nationalIdLast4,
            portfolio: profile.portfolio.map((p) => ({
              id: p.id,
              url: p.url,
              caption: p.caption,
            })),
          }
        : null,
      locations: org.facilities.map((f) => ({
        city: f.address.city,
        province: f.address.province,
        latitude: f.geoPoint ? Number(f.geoPoint.latitude) : null,
        longitude: f.geoPoint ? Number(f.geoPoint.longitude) : null,
      })),
      serviceAreas: org.serviceAreas.map((a) => ({
        city: a.city,
        province: a.province,
        radiusKm: a.radiusKm != null ? Number(a.radiusKm) : null,
      })),
      reviews,
    };
  }

  async getMine(userId: string, organizationId: string) {
    await this.requireProWriter(userId, organizationId);
    await this.ensureProfile(organizationId);
    const scored = await this.recomputeScore(organizationId);
    return this.toOwnerDto(organizationId, scored);
  }

  async updateProfile(userId: string, organizationId: string, input: UpdateProProfileInput) {
    await this.requireProWriter(userId, organizationId);
    await this.ensureProfile(organizationId);

    if (input.primarySpecialty != null || input.city != null) {
      const orgUpdate: { primarySpecialty?: string | null; name?: string } = {};
      if (input.primarySpecialty != null) orgUpdate.primarySpecialty = input.primarySpecialty;
      await this.prisma.organization.update({
        where: { id: organizationId },
        data: orgUpdate,
      });
      if (input.city) {
        const place = resolveIranPlace(input.city);
        if (place) {
          const facility = await this.prisma.facility.findFirst({
            where: { organizationId, isPublicLocation: true },
            include: { address: true },
          });
          if (facility) {
            await this.prisma.address.update({
              where: { id: facility.addressId },
              data: {
                city: place.city,
                province: place.province || undefined,
                countryCode: place.countryCode,
              },
            });
            if (facility.geoPointId) {
              await this.prisma.geoPoint.update({
                where: { id: facility.geoPointId },
                data: { latitude: place.latitude, longitude: place.longitude },
              });
            }
          }
        }
      }
      await this.seoContent.ensureProfessionalSeo(organizationId);
    }

    await this.prisma.professionalProfile.update({
      where: { organizationId },
      data: {
        displayName: input.displayName,
        bio: input.bio,
        yearsExperience: input.yearsExperience === undefined ? undefined : input.yearsExperience,
        secondarySpecialties: input.secondarySpecialties,
        projectTypes: input.projectTypes,
        serviceRadiusKm: input.serviceRadiusKm === undefined ? undefined : input.serviceRadiusKm,
        priceRangeMin: input.priceRangeMin === undefined ? undefined : input.priceRangeMin,
        priceRangeMax: input.priceRangeMax === undefined ? undefined : input.priceRangeMax,
        priceCurrency: input.priceCurrency === undefined ? undefined : input.priceCurrency,
        priceNote: input.priceNote === undefined ? undefined : input.priceNote,
        availabilityNote:
          input.availabilityNote === undefined ? undefined : input.availabilityNote,
      },
    });

    const scored = await this.recomputeScore(organizationId);
    return this.toOwnerDto(organizationId, scored);
  }

  async setNationalId(userId: string, organizationId: string, nationalId: string) {
    await this.requireProWriter(userId, organizationId);
    await this.ensureProfile(organizationId);
    const clean = nationalId.replace(/\D/g, '');
    if (!isValidIranianNationalId(clean)) {
      throw new BadRequestException('کد ملی نامعتبر است');
    }
    await this.prisma.professionalProfile.update({
      where: { organizationId },
      data: {
        nationalIdHash: hashNationalId(clean),
        nationalIdLast4: clean.slice(-4),
        nationalIdVerifiedAt: new Date(),
      },
    });
    const scored = await this.recomputeScore(organizationId);
    return this.toOwnerDto(organizationId, scored);
  }

  async requestMobileOtp(userId: string, organizationId: string, rawPhone: string) {
    await this.requireProWriter(userId, organizationId);
    await this.ensureProfile(organizationId);
    const phone = normalizeIranMobile(rawPhone);
    if (!phone) throw new BadRequestException('شماره موبایل نامعتبر است');

    const code = String(randomInt(100000, 999999));
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    await this.prisma.phoneOtpChallenge.create({
      data: {
        phone,
        codeHash: hashOtpCode(code, phone),
        purpose: 'pro_mobile_verify',
        organizationId,
        expiresAt,
      },
    });

    await this.prisma.professionalProfile.update({
      where: { organizationId },
      data: { mobilePhone: phone, mobileVerifiedAt: null },
    });

    // SMS provider not configured yet — expose OTP only in non-production for QA.
    const expose = process.env.NODE_ENV !== 'production';
    return {
      phone,
      expiresInSec: 300,
      ...(expose ? { devCode: code } : {}),
      note: expose
        ? 'DEV: SMS provider not configured — use devCode'
        : 'کد تأیید ارسال شد',
    };
  }

  async confirmMobileOtp(userId: string, organizationId: string, rawPhone: string, code: string) {
    await this.requireProWriter(userId, organizationId);
    const phone = normalizeIranMobile(rawPhone);
    if (!phone) throw new BadRequestException('شماره موبایل نامعتبر است');

    const challenge = await this.prisma.phoneOtpChallenge.findFirst({
      where: {
        phone,
        purpose: 'pro_mobile_verify',
        organizationId,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!challenge) throw new BadRequestException('کد منقضی یا نامعتبر است');
    if (challenge.attempts >= challenge.maxAttempts) {
      throw new BadRequestException('تعداد تلاش بیش از حد');
    }

    const ok = challenge.codeHash === hashOtpCode(code.trim(), phone);
    await this.prisma.phoneOtpChallenge.update({
      where: { id: challenge.id },
      data: {
        attempts: { increment: 1 },
        ...(ok ? { consumedAt: new Date() } : {}),
      },
    });
    if (!ok) throw new BadRequestException('کد تأیید اشتباه است');

    await this.prisma.professionalProfile.update({
      where: { organizationId },
      data: { mobilePhone: phone, mobileVerifiedAt: new Date() },
    });
    // Also mirror on user.phone when empty
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (user && !user.phone) {
      await this.prisma.user.update({ where: { id: userId }, data: { phone } }).catch(() => null);
    }

    const scored = await this.recomputeScore(organizationId);
    return this.toOwnerDto(organizationId, scored);
  }

  async uploadAvatar(userId: string, organizationId: string, file: Express.Multer.File) {
    await this.requireProWriter(userId, organizationId);
    await this.ensureProfile(organizationId);
    if (!file?.buffer?.length) throw new BadRequestException('file required');
    ensureDir(UPLOAD_ROOT);
    const name = `${organizationId}-avatar-${Date.now()}.jpg`;
    const abs = join(UPLOAD_ROOT, name);
    writeFileSync(abs, file.buffer);
    const url = `/api/uploads/professionals/${name}`;
    await this.prisma.professionalProfile.update({
      where: { organizationId },
      data: { avatarUrl: url },
    });
    const scored = await this.recomputeScore(organizationId);
    return this.toOwnerDto(organizationId, scored);
  }

  async addPortfolio(
    userId: string,
    organizationId: string,
    file: Express.Multer.File,
    caption?: string,
  ) {
    await this.requireProWriter(userId, organizationId);
    const profile = await this.ensureProfile(organizationId);
    if (!file?.buffer?.length) throw new BadRequestException('file required');
    ensureDir(UPLOAD_ROOT);
    const name = `${organizationId}-work-${Date.now()}.jpg`;
    writeFileSync(join(UPLOAD_ROOT, name), file.buffer);
    const url = `/api/uploads/professionals/${name}`;
    await this.prisma.professionalPortfolio.create({
      data: {
        profileId: profile.id,
        url,
        caption: caption || null,
        sortOrder: profile.portfolioCount,
      },
    });
    const scored = await this.recomputeScore(organizationId);
    return this.toOwnerDto(organizationId, scored);
  }

  async createReview(input: {
    organizationIdOrSlug: string;
    authorUserId?: string;
    authorName: string;
    rating: number;
    body?: string;
  }) {
    if (!input.authorName?.trim() || input.authorName.trim().length < 2) {
      throw new BadRequestException('نام الزامی است');
    }
    if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
      throw new BadRequestException('امتیاز باید ۱ تا ۵ باشد');
    }
    const org = await this.prisma.organization.findFirst({
      where: {
        isProfessional: true,
        isActive: true,
        OR: [{ id: input.organizationIdOrSlug }, { slug: input.organizationIdOrSlug }],
      },
    });
    if (!org) throw new NotFoundException('Professional not found');

    const review = await this.prisma.professionalReview.create({
      data: {
        organizationId: org.id,
        authorUserId: input.authorUserId || null,
        authorName: input.authorName.trim(),
        rating: input.rating,
        body: input.body?.trim() || null,
        // Logged-in buyers auto-approve; guests need moderation.
        status: input.authorUserId
          ? ProfessionalReviewStatus.APPROVED
          : ProfessionalReviewStatus.PENDING,
      },
    });
    await this.refreshReviewAggregates(org.id);
    await this.recomputeScore(org.id);
    return {
      publicId: review.publicId,
      status: review.status,
      rating: review.rating,
    };
  }

  async onboardQuick(userId: string, input: {
    displayName: string;
    specialty: string;
    city: string;
    mobilePhone: string;
    nationalId: string;
  }) {
    const phone = normalizeIranMobile(input.mobilePhone);
    if (!phone) throw new BadRequestException('شماره موبایل نامعتبر است');
    const nid = input.nationalId.replace(/\D/g, '');
    if (!isValidIranianNationalId(nid)) throw new BadRequestException('کد ملی نامعتبر است');

    const baseSlug = slugifyProName(input.displayName, `pro-${Date.now().toString(36)}`);
    let slug = baseSlug;
    for (let i = 0; i < 6; i++) {
      const clash = await this.prisma.organization.findUnique({ where: { slug } });
      if (!clash) break;
      slug = `${baseSlug}-${randomInt(100, 999)}`;
    }

    const place = resolveIranPlace(input.city);
    const org = await this.prisma.organization.create({
      data: {
        name: input.displayName.trim(),
        slug,
        canSell: false,
        canBuy: false,
        isProfessional: true,
        primarySpecialty: input.specialty,
        members: { create: { userId, orgRole: OrgRole.ORG_OWNER } },
      },
    });

    if (place || input.city) {
      const city = place?.city || input.city;
      const address = await this.prisma.address.create({
        data: {
          countryCode: place?.countryCode || 'IR',
          province: place?.province || undefined,
          city,
          line1: city,
        },
      });
      let geoPointId: string | undefined;
      if (place) {
        const gp = await this.prisma.geoPoint.create({
          data: { latitude: place.latitude, longitude: place.longitude, accuracyM: 5000 },
        });
        geoPointId = gp.id;
      }
      await this.prisma.facility.create({
        data: {
          organizationId: org.id,
          name: `${input.displayName} — محل خدمت`,
          type: FacilityType.SERVICE_LOCATION,
          isPublicLocation: true,
          addressId: address.id,
          geoPointId,
        },
      });
      if (place) {
        const center = await this.prisma.geoPoint.create({
          data: { latitude: place.latitude, longitude: place.longitude, accuracyM: 5000 },
        });
        await this.prisma.serviceArea.create({
          data: {
            organizationId: org.id,
            name: place.province ? `${place.city}, ${place.province}` : place.city,
            countryCode: place.countryCode,
            province: place.province || undefined,
            city: place.city,
            centerPointId: center.id,
            radiusKm: 40,
            isActive: true,
          },
        });
      }
    }

    await this.prisma.professionalProfile.create({
      data: {
        organizationId: org.id,
        displayName: input.displayName.trim(),
        mobilePhone: phone,
        nationalIdHash: hashNationalId(nid),
        nationalIdLast4: nid.slice(-4),
        nationalIdVerifiedAt: new Date(),
      },
    });

    await this.seoContent.ensureProfessionalSeo(org.id);
    // Kick OTP automatically so UI can verify next.
    const otp = await this.requestMobileOtp(userId, org.id, phone);
    const scored = await this.recomputeScore(org.id);
    return {
      organization: { id: org.id, slug: org.slug, name: org.name },
      profile: await this.toOwnerDto(org.id, scored),
      otp,
    };
  }

  async approveReview(publicId: string) {
    const review = await this.prisma.professionalReview.update({
      where: { publicId },
      data: { status: ProfessionalReviewStatus.APPROVED },
    });
    await this.refreshReviewAggregates(review.organizationId);
    await this.recomputeScore(review.organizationId);
    return { publicId: review.publicId, status: review.status };
  }

  async recomputeScore(organizationId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        professionalProfile: { include: { portfolio: true } },
        facilities: {
          where: { isPublicLocation: true },
          take: 1,
          include: { address: true },
        },
      },
    });
    if (!org?.professionalProfile) return null;
    const p = org.professionalProfile;
    const computed = computeProfessionalProfileScore({
      hasDisplayName: Boolean(p.displayName || org.name),
      hasSpecialty: Boolean(org.primarySpecialty),
      hasCity: Boolean(org.facilities[0]?.address?.city),
      mobileVerified: Boolean(p.mobileVerifiedAt),
      hasNationalId: Boolean(p.nationalIdHash),
      hasAvatar: Boolean(p.avatarUrl),
      bioLength: (p.bio || '').trim().length,
      yearsExperience: p.yearsExperience,
      secondarySpecialtyCount: p.secondarySpecialties.length,
      portfolioCount: p.portfolio.length,
      hasServiceRadius: p.serviceRadiusKm != null || Boolean(org.facilities.length),
      hasPriceInfo:
        p.priceRangeMin != null || p.priceRangeMax != null || Boolean((p.priceNote || '').trim()),
    });

    const identityVerifiedAt = computed.identityReady
      ? p.identityVerifiedAt || new Date()
      : null;

    return this.prisma.professionalProfile.update({
      where: { organizationId },
      data: {
        profileScore: computed.score,
        portfolioCount: p.portfolio.length,
        identityVerifiedAt,
      },
      include: { portfolio: { orderBy: { sortOrder: 'asc' } } },
    });
  }

  private async refreshReviewAggregates(organizationId: string) {
    const agg = await this.prisma.professionalReview.aggregate({
      where: { organizationId, status: ProfessionalReviewStatus.APPROVED },
      _avg: { rating: true },
      _count: { _all: true },
    });
    await this.prisma.professionalProfile.updateMany({
      where: { organizationId },
      data: {
        reviewCount: agg._count._all,
        ratingAvg: agg._avg.rating,
      },
    });
  }

  private async requireProWriter(userId: string, organizationId: string) {
    const membership = await this.orgAccess.requireWriter(userId, organizationId);
    await this.orgAccess.requireCapability(organizationId, 'isProfessional');
    return membership;
  }

  private async toOwnerDto(organizationId: string, profile: Awaited<ReturnType<typeof this.recomputeScore>>) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        facilities: {
          where: { isPublicLocation: true },
          take: 1,
          include: { address: true },
        },
      },
    });
    if (!org || !profile) throw new NotFoundException('Profile not found');
    const score = computeProfessionalProfileScore({
      hasDisplayName: Boolean(profile.displayName || org.name),
      hasSpecialty: Boolean(org.primarySpecialty),
      hasCity: Boolean(org.facilities[0]?.address?.city),
      mobileVerified: Boolean(profile.mobileVerifiedAt),
      hasNationalId: Boolean(profile.nationalIdHash),
      hasAvatar: Boolean(profile.avatarUrl),
      bioLength: (profile.bio || '').trim().length,
      yearsExperience: profile.yearsExperience,
      secondarySpecialtyCount: profile.secondarySpecialties.length,
      portfolioCount: profile.portfolio?.length || profile.portfolioCount,
      hasServiceRadius:
        profile.serviceRadiusKm != null || Boolean(org.facilities.length),
      hasPriceInfo:
        profile.priceRangeMin != null ||
        profile.priceRangeMax != null ||
        Boolean((profile.priceNote || '').trim()),
    });

    return {
      organizationId: org.id,
      slug: org.slug,
      name: org.name,
      specialty: org.primarySpecialty,
      city: org.facilities[0]?.address?.city || null,
      displayName: profile.displayName,
      bio: profile.bio,
      yearsExperience: profile.yearsExperience,
      mobilePhone: profile.mobilePhone,
      mobileVerified: Boolean(profile.mobileVerifiedAt),
      nationalIdLast4: profile.nationalIdLast4,
      nationalIdSet: Boolean(profile.nationalIdHash),
      identityVerified: Boolean(profile.identityVerifiedAt),
      avatarUrl: profile.avatarUrl,
      secondarySpecialties: profile.secondarySpecialties,
      projectTypes: profile.projectTypes,
      serviceRadiusKm: profile.serviceRadiusKm,
      priceRangeMin: profile.priceRangeMin != null ? Number(profile.priceRangeMin) : null,
      priceRangeMax: profile.priceRangeMax != null ? Number(profile.priceRangeMax) : null,
      priceCurrency: profile.priceCurrency,
      priceNote: profile.priceNote,
      availabilityNote: profile.availabilityNote,
      profileScore: profile.profileScore,
      scoreBreakdown: score.breakdown,
      reviewCount: profile.reviewCount,
      ratingAvg: profile.ratingAvg,
      portfolio: (profile.portfolio || []).map((p) => ({
        id: p.id,
        url: p.url,
        caption: p.caption,
      })),
    };
  }
}

function ensureDir(path: string) {
  if (!existsSync(path)) mkdirSync(path, { recursive: true });
}
