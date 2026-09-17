import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  ProjectLeadTimeSource,
  ProjectMemberRole,
  ProjectRequirementKind,
  ProjectRequirementSource,
  ProjectRequirementStatus,
  ProjectStageStatus,
  ProjectStatus,
} from '@prisma/client';
import {
  PROJECT_STAGE_CATALOG,
  computeRecommendedRfqDate,
  projectStageByCode,
  projectStageLabel,
} from '@peytakilid/shared-types';
import { OrgAccessService } from '../common/org-access.service';
import { resolveIranPlace } from '../geo/iran-place';
import { PrismaService } from '../prisma/prisma.service';

export type CreateProjectInput = {
  ownerOrganizationId: string;
  name: string;
  projectTypeCode?: string | null;
  areaM2?: number | null;
  startDate?: string | null;
  estimatedCompletionDate?: string | null;
  city?: string | null;
  countryCode?: string | null;
  notes?: string | null;
  /** If true, seed all catalog stages as PLANNED and activate first. */
  seedStages?: boolean;
};

export type CreateRequirementInput = {
  title: string;
  description?: string | null;
  kind?: 'PRODUCT' | 'SERVICE';
  stageCode?: string | null;
  categoryId?: string | null;
  specialtyCode?: string | null;
  quantity?: number | null;
  uomCode?: string | null;
  needByDate?: string | null;
  procurementTargetDate?: string | null;
  source?: 'MANUAL' | 'STAGE_TEMPLATE' | 'AI_SUGGESTION';
};

@Injectable()
export class ProjectService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orgAccess: OrgAccessService,
  ) {}

  async listForUser(userId: string, locale = 'fa') {
    const memberships = await this.prisma.organizationMember.findMany({
      where: { userId },
      select: { organizationId: true },
    });
    const orgIds = memberships.map((m) => m.organizationId);
    const projects = await this.prisma.project.findMany({
      where: {
        OR: [
          { ownerOrganizationId: { in: orgIds } },
          { members: { some: { userId } } },
        ],
        status: { not: ProjectStatus.ARCHIVED },
      },
      include: {
        address: true,
        stages: true,
        requirements: { select: { id: true, status: true } },
        _count: { select: { requirements: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });
    return projects.map((p) => this.toListDto(p, locale));
  }

  async getWorkspace(userId: string, projectIdOrPublicId: string, locale = 'fa') {
    const project = await this.requireProjectAccess(userId, projectIdOrPublicId, 'read');
    const full = await this.prisma.project.findUnique({
      where: { id: project.id },
      include: {
        address: true,
        geoPoint: true,
        stages: { orderBy: { sortOrder: 'asc' } },
        requirements: {
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          include: {
            category: { select: { id: true, slug: true, nameEn: true, nameFa: true } },
            listing: {
              select: {
                id: true,
                publicId: true,
                slug: true,
                title: true,
                leadTimeDays: true,
                status: true,
              },
            },
            rfq: { select: { id: true, publicId: true, status: true } },
            quote: { select: { id: true, publicId: true, status: true } },
            order: { select: { id: true, publicId: true, status: true } },
            professionalLead: {
              select: { id: true, publicId: true, status: true, specialtyHints: true },
            },
          },
        },
        media: {
          where: { status: { in: ['APPROVED', 'PRIVATE', 'PENDING'] } },
          orderBy: { sortOrder: 'asc' },
          take: 24,
        },
      },
    });
    if (!full) throw new NotFoundException('Project not found');

    const rfqs = await this.prisma.rfq.findMany({
      where: { projectId: full.id },
      select: { id: true, publicId: true, status: true, createdAt: true, projectRequirementId: true },
      orderBy: { createdAt: 'desc' },
      take: 40,
    });
    const leads = await this.prisma.professionalLead.findMany({
      where: { projectId: full.id },
      select: {
        id: true,
        publicId: true,
        status: true,
        specialtyHints: true,
        city: true,
        projectRequirementId: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 40,
    });

    const progress = this.computeProgress(full.stages);
    const currentStage = full.stages.find((s) => s.stageCode === full.currentStageCode) ||
      full.stages.find((s) => s.status === ProjectStageStatus.ACTIVE) ||
      null;

    const upcoming = full.requirements.filter((r) =>
      ['PLANNED', 'SOURCING', 'RFQ_OPEN'].includes(r.status),
    );

    return {
      id: full.id,
      publicId: full.publicId,
      name: full.name,
      projectTypeCode: full.projectTypeCode,
      areaM2: full.areaM2 != null ? Number(full.areaM2) : null,
      startDate: full.startDate,
      estimatedCompletionDate: full.estimatedCompletionDate,
      currentStageCode: full.currentStageCode,
      currentStageLabel: full.currentStageCode
        ? projectStageLabel(full.currentStageCode, locale)
        : null,
      status: full.status,
      notes: full.notes,
      progressPct: progress,
      location: full.address
        ? {
            city: full.address.city,
            province: full.address.province,
            countryCode: full.address.countryCode,
            line1: full.address.line1,
            latitude: full.geoPoint ? Number(full.geoPoint.latitude) : null,
            longitude: full.geoPoint ? Number(full.geoPoint.longitude) : null,
          }
        : null,
      ownerOrganizationId: full.ownerOrganizationId,
      stages: full.stages.map((s) => ({
        id: s.id,
        stageCode: s.stageCode,
        label: projectStageLabel(s.stageCode, locale),
        sortOrder: s.sortOrder,
        status: s.status,
        progressPct: s.progressPct,
        startedAt: s.startedAt,
        completedAt: s.completedAt,
        categorySlugHints: projectStageByCode(s.stageCode)?.categorySlugHints || [],
        specialtyCodes: projectStageByCode(s.stageCode)?.specialtyCodes || [],
      })),
      requirements: full.requirements.map((r) => this.toRequirementDto(r, locale)),
      upcomingNeeds: upcoming.map((r) => this.toRequirementDto(r, locale)),
      procurement: {
        rfqs,
        leads,
        openRequirementCount: upcoming.length,
      },
      media: full.media.map((m) => ({
        id: m.id,
        publicId: m.publicId,
        url: m.url,
        mimeType: m.mimeType,
        altText: m.altText,
      })),
      stageCatalog: PROJECT_STAGE_CATALOG.map((s) => ({
        code: s.code,
        label: locale === 'en' ? s.nameEn : s.nameFa,
        sortOrder: s.sortOrder,
        categorySlugHints: s.categorySlugHints,
        specialtyCodes: s.specialtyCodes,
      })),
    };
  }

  async create(userId: string, input: CreateProjectInput, locale = 'fa') {
    if (!input.name?.trim()) throw new BadRequestException('name required');
    await this.orgAccess.requireBuyerWriter(userId, input.ownerOrganizationId);

    let addressId: string | undefined;
    let geoPointId: string | undefined;
    if (input.city?.trim()) {
      const place = resolveIranPlace(input.city.trim());
      const city = place?.city || input.city.trim();
      const address = await this.prisma.address.create({
        data: {
          countryCode: (input.countryCode || place?.countryCode || 'IR').toUpperCase(),
          province: place?.province || undefined,
          city,
          line1: city,
        },
      });
      addressId = address.id;
      if (place) {
        const gp = await this.prisma.geoPoint.create({
          data: { latitude: place.latitude, longitude: place.longitude, accuracyM: 5000 },
        });
        geoPointId = gp.id;
      }
    }

    const seed = input.seedStages !== false;
    const stagesData = seed
      ? PROJECT_STAGE_CATALOG.map((s, idx) => ({
          stageCode: s.code,
          sortOrder: s.sortOrder,
          status:
            idx === 0 ? ProjectStageStatus.ACTIVE : ProjectStageStatus.PLANNED,
          progressPct: idx === 0 ? 5 : 0,
          startedAt: idx === 0 ? new Date() : null,
        }))
      : [];

    const project = await this.prisma.project.create({
      data: {
        ownerOrganizationId: input.ownerOrganizationId,
        createdByUserId: userId,
        name: input.name.trim(),
        projectTypeCode: input.projectTypeCode || null,
        areaM2: input.areaM2 ?? null,
        startDate: parseDate(input.startDate),
        estimatedCompletionDate: parseDate(input.estimatedCompletionDate),
        currentStageCode: stagesData[0]?.stageCode || null,
        notes: input.notes || null,
        addressId,
        geoPointId,
        members: {
          create: { userId, role: ProjectMemberRole.OWNER },
        },
        stages: stagesData.length ? { create: stagesData } : undefined,
      },
    });

    return this.getWorkspace(userId, project.id, locale);
  }

  async updateProject(
    userId: string,
    projectId: string,
    input: Partial<{
      name: string;
      projectTypeCode: string | null;
      areaM2: number | null;
      startDate: string | null;
      estimatedCompletionDate: string | null;
      status: ProjectStatus;
      notes: string | null;
      city: string | null;
    }>,
    locale = 'fa',
  ) {
    const project = await this.requireProjectAccess(userId, projectId, 'write');
    let addressId: string | null | undefined = undefined;
    let geoPointId: string | null | undefined = undefined;
    if (input.city !== undefined) {
      if (!input.city?.trim()) {
        addressId = null;
        geoPointId = null;
      } else {
        const place = resolveIranPlace(input.city.trim());
        const city = place?.city || input.city.trim();
        const address = await this.prisma.address.create({
          data: {
            countryCode: place?.countryCode || 'IR',
            province: place?.province || undefined,
            city,
            line1: city,
          },
        });
        addressId = address.id;
        if (place) {
          const gp = await this.prisma.geoPoint.create({
            data: { latitude: place.latitude, longitude: place.longitude, accuracyM: 5000 },
          });
          geoPointId = gp.id;
        } else {
          geoPointId = null;
        }
      }
    }

    await this.prisma.project.update({
      where: { id: project.id },
      data: {
        name: input.name?.trim() || undefined,
        projectTypeCode: input.projectTypeCode === undefined ? undefined : input.projectTypeCode,
        areaM2: input.areaM2 === undefined ? undefined : input.areaM2,
        startDate: input.startDate === undefined ? undefined : parseDate(input.startDate),
        estimatedCompletionDate:
          input.estimatedCompletionDate === undefined
            ? undefined
            : parseDate(input.estimatedCompletionDate),
        status: input.status,
        notes: input.notes === undefined ? undefined : input.notes,
        addressId,
        geoPointId,
      },
    });
    return this.getWorkspace(userId, project.id, locale);
  }

  async setCurrentStage(userId: string, projectId: string, stageCode: string, locale = 'fa') {
    const project = await this.requireProjectAccess(userId, projectId, 'write');
    if (!projectStageByCode(stageCode)) throw new BadRequestException('Unknown stageCode');

    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.projectStage.findUnique({
        where: { projectId_stageCode: { projectId: project.id, stageCode } },
      });
      if (!existing) {
        const def = projectStageByCode(stageCode)!;
        await tx.projectStage.create({
          data: {
            projectId: project.id,
            stageCode,
            sortOrder: def.sortOrder,
            status: ProjectStageStatus.ACTIVE,
            progressPct: 5,
            startedAt: new Date(),
          },
        });
      } else {
        await tx.projectStage.update({
          where: { id: existing.id },
          data: {
            status: ProjectStageStatus.ACTIVE,
            startedAt: existing.startedAt || new Date(),
            progressPct: Math.max(existing.progressPct, 5),
          },
        });
      }
      await tx.projectStage.updateMany({
        where: {
          projectId: project.id,
          stageCode: { not: stageCode },
          status: ProjectStageStatus.ACTIVE,
        },
        data: { status: ProjectStageStatus.PLANNED },
      });
      await tx.project.update({
        where: { id: project.id },
        data: { currentStageCode: stageCode },
      });
    });
    return this.getWorkspace(userId, project.id, locale);
  }

  async updateStage(
    userId: string,
    projectId: string,
    stageCode: string,
    input: { status?: ProjectStageStatus; progressPct?: number },
    locale = 'fa',
  ) {
    const project = await this.requireProjectAccess(userId, projectId, 'write');
    const stage = await this.prisma.projectStage.findUnique({
      where: { projectId_stageCode: { projectId: project.id, stageCode } },
    });
    if (!stage) throw new NotFoundException('Stage not found');

    const status = input.status ?? stage.status;
    const progressPct =
      input.progressPct != null
        ? Math.max(0, Math.min(100, Math.round(input.progressPct)))
        : stage.progressPct;

    await this.prisma.projectStage.update({
      where: { id: stage.id },
      data: {
        status,
        progressPct: status === ProjectStageStatus.DONE ? 100 : progressPct,
        startedAt:
          status === ProjectStageStatus.ACTIVE || status === ProjectStageStatus.DONE
            ? stage.startedAt || new Date()
            : stage.startedAt,
        completedAt: status === ProjectStageStatus.DONE ? new Date() : null,
      },
    });

    if (status === ProjectStageStatus.ACTIVE) {
      await this.prisma.project.update({
        where: { id: project.id },
        data: { currentStageCode: stageCode },
      });
      await this.prisma.projectStage.updateMany({
        where: {
          projectId: project.id,
          stageCode: { not: stageCode },
          status: ProjectStageStatus.ACTIVE,
        },
        data: { status: ProjectStageStatus.PLANNED },
      });
    }

    return this.getWorkspace(userId, project.id, locale);
  }

  async addRequirement(userId: string, projectId: string, input: CreateRequirementInput, locale = 'fa') {
    const project = await this.requireProjectAccess(userId, projectId, 'write');
    if (!input.title?.trim()) throw new BadRequestException('title required');
    const kind =
      input.kind === 'SERVICE'
        ? ProjectRequirementKind.SERVICE
        : ProjectRequirementKind.PRODUCT;

    const req = await this.prisma.projectRequirement.create({
      data: {
        projectId: project.id,
        title: input.title.trim(),
        description: input.description || null,
        kind,
        stageCode: input.stageCode || project.currentStageCode || null,
        categoryId: input.categoryId || null,
        specialtyCode: input.specialtyCode || null,
        quantity: input.quantity ?? null,
        uomCode: input.uomCode || null,
        needByDate: parseDate(input.needByDate),
        procurementTargetDate: parseDate(input.procurementTargetDate),
        source:
          input.source === 'STAGE_TEMPLATE'
            ? ProjectRequirementSource.STAGE_TEMPLATE
            : input.source === 'AI_SUGGESTION'
              ? ProjectRequirementSource.AI_SUGGESTION
              : ProjectRequirementSource.MANUAL,
        status: ProjectRequirementStatus.PLANNED,
      },
    });
    return {
      requirement: await this.getRequirementDto(req.id, locale),
      workspace: await this.getWorkspace(userId, project.id, locale),
    };
  }

  async seedStageSuggestions(userId: string, projectId: string, stageCode: string, locale = 'fa') {
    const project = await this.requireProjectAccess(userId, projectId, 'write');
    const def = projectStageByCode(stageCode);
    if (!def) throw new BadRequestException('Unknown stageCode');

    const categories = def.categorySlugHints.length
      ? await this.prisma.category.findMany({
          where: { slug: { in: def.categorySlugHints }, isActive: true },
          select: { id: true, slug: true, nameEn: true, nameFa: true, defaultUomCode: true },
        })
      : [];
    const bySlug = new Map(categories.map((c) => [c.slug, c]));

    const created = [];
    for (const slug of def.categorySlugHints) {
      const cat = bySlug.get(slug);
      if (!cat) continue;
      const title = locale === 'en' ? cat.nameEn : cat.nameFa || cat.nameEn;
      const row = await this.prisma.projectRequirement.create({
        data: {
          projectId: project.id,
          stageCode,
          kind: ProjectRequirementKind.PRODUCT,
          title,
          categoryId: cat.id,
          uomCode: cat.defaultUomCode || null,
          source: ProjectRequirementSource.STAGE_TEMPLATE,
          status: ProjectRequirementStatus.PLANNED,
        },
      });
      created.push(row.id);
    }
    for (const code of def.specialtyCodes) {
      const row = await this.prisma.projectRequirement.create({
        data: {
          projectId: project.id,
          stageCode,
          kind: ProjectRequirementKind.SERVICE,
          title: code.replace(/_/g, ' '),
          specialtyCode: code,
          source: ProjectRequirementSource.STAGE_TEMPLATE,
          status: ProjectRequirementStatus.PLANNED,
        },
      });
      created.push(row.id);
    }

    return {
      createdCount: created.length,
      workspace: await this.getWorkspace(userId, project.id, locale),
    };
  }

  async linkListing(
    userId: string,
    projectId: string,
    requirementId: string,
    listingId: string,
    locale = 'fa',
  ) {
    const project = await this.requireProjectAccess(userId, projectId, 'write');
    const req = await this.requireRequirement(project.id, requirementId);
    const listing = await this.prisma.listing.findUnique({ where: { id: listingId } });
    if (!listing || listing.status !== 'PUBLISHED') {
      throw new BadRequestException('Published listing required');
    }

    await this.prisma.projectRequirement.update({
      where: { id: req.id },
      data: {
        listingId: listing.id,
        categoryId: req.categoryId || listing.categoryId,
        uomCode: req.uomCode || listing.uomCode,
        verifiedLeadTimeDays: listing.leadTimeDays,
        leadTimeSource:
          listing.leadTimeDays != null
            ? ProjectLeadTimeSource.LISTING
            : ProjectLeadTimeSource.NONE,
        status:
          req.status === ProjectRequirementStatus.PLANNED
            ? ProjectRequirementStatus.SOURCING
            : req.status,
        procurementTargetDate:
          req.procurementTargetDate ||
          computeRecommendedRfqDate(req.needByDate, listing.leadTimeDays),
      },
    });
    return this.getWorkspace(userId, project.id, locale);
  }

  async linkRfq(
    userId: string,
    projectId: string,
    requirementId: string,
    rfqId: string,
    locale = 'fa',
  ) {
    const project = await this.requireProjectAccess(userId, projectId, 'write');
    const req = await this.requireRequirement(project.id, requirementId);
    const rfq = await this.prisma.rfq.findUnique({ where: { id: rfqId } });
    if (!rfq) throw new NotFoundException('RFQ not found');
    if (rfq.buyerOrganizationId !== project.ownerOrganizationId) {
      throw new ForbiddenException('RFQ belongs to another organization');
    }

    await this.prisma.$transaction([
      this.prisma.projectRequirement.update({
        where: { id: req.id },
        data: {
          rfqId: rfq.id,
          status: ProjectRequirementStatus.RFQ_OPEN,
        },
      }),
      this.prisma.rfq.update({
        where: { id: rfq.id },
        data: {
          projectId: project.id,
          projectRequirementId: req.id,
        },
      }),
    ]);
    return this.getWorkspace(userId, project.id, locale);
  }

  async linkProfessionalLead(
    userId: string,
    projectId: string,
    requirementId: string,
    leadId: string,
    locale = 'fa',
  ) {
    const project = await this.requireProjectAccess(userId, projectId, 'write');
    const req = await this.requireRequirement(project.id, requirementId);
    const lead = await this.prisma.professionalLead.findUnique({ where: { id: leadId } });
    if (!lead) throw new NotFoundException('Lead not found');

    await this.prisma.$transaction([
      this.prisma.professionalLead.update({
        where: { id: lead.id },
        data: { projectId: project.id, projectRequirementId: req.id },
      }),
      this.prisma.projectRequirement.update({
        where: { id: req.id },
        data: {
          professionalLeadId: lead.id,
          status:
            req.status === ProjectRequirementStatus.PLANNED
              ? ProjectRequirementStatus.SOURCING
              : req.status,
        },
      }),
    ]);
    return this.getWorkspace(userId, project.id, locale);
  }

  async syncCommerceLinks(userId: string, projectId: string, locale = 'fa') {
    const project = await this.requireProjectAccess(userId, projectId, 'write');
    const requirements = await this.prisma.projectRequirement.findMany({
      where: { projectId: project.id, rfqId: { not: null } },
    });

    for (const req of requirements) {
      if (!req.rfqId) continue;
      const quote = await this.prisma.quote.findFirst({
        where: {
          rfqId: req.rfqId,
          status: { in: ['SUBMITTED', 'ACCEPTED'] },
        },
        orderBy: { updatedAt: 'desc' },
        include: { items: true, order: true },
      });
      if (!quote) continue;

      const leadFromQuote = quote.items.find((i) => i.leadTimeDays != null)?.leadTimeDays;
      await this.prisma.projectRequirement.update({
        where: { id: req.id },
        data: {
          quoteId: quote.id,
          orderId: quote.order?.id || req.orderId,
          verifiedLeadTimeDays: leadFromQuote ?? req.verifiedLeadTimeDays,
          leadTimeSource:
            leadFromQuote != null
              ? ProjectLeadTimeSource.QUOTE
              : req.leadTimeSource,
          status: quote.order
            ? ProjectRequirementStatus.ORDERED
            : quote.status === 'ACCEPTED'
              ? ProjectRequirementStatus.ORDERED
              : ProjectRequirementStatus.RFQ_OPEN,
        },
      });
    }
    return this.getWorkspace(userId, project.id, locale);
  }

  stageCatalog(locale = 'fa') {
    return PROJECT_STAGE_CATALOG.map((s) => ({
      code: s.code,
      label: locale === 'en' ? s.nameEn : s.nameFa,
      sortOrder: s.sortOrder,
      categorySlugHints: s.categorySlugHints,
      specialtyCodes: s.specialtyCodes,
    }));
  }

  private async requireRequirement(projectId: string, requirementId: string) {
    const req = await this.prisma.projectRequirement.findFirst({
      where: {
        projectId,
        OR: [{ id: requirementId }, { publicId: requirementId }],
      },
    });
    if (!req) throw new NotFoundException('Requirement not found');
    return req;
  }

  private async requireProjectAccess(
    userId: string,
    projectIdOrPublicId: string,
    mode: 'read' | 'write',
  ) {
    const project = await this.prisma.project.findFirst({
      where: {
        OR: [{ id: projectIdOrPublicId }, { publicId: projectIdOrPublicId }],
      },
    });
    if (!project) throw new NotFoundException('Project not found');

    const orgMember = await this.prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: {
          userId,
          organizationId: project.ownerOrganizationId,
        },
      },
    });
    const projectMember = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: project.id, userId } },
    });

    if (!orgMember && !projectMember) {
      throw new ForbiddenException('Not a project member');
    }

    if (mode === 'write') {
      const writeOrg =
        orgMember &&
        ['ORG_OWNER', 'ORG_ADMIN', 'ORG_STAFF'].includes(orgMember.orgRole);
      const writeProj =
        projectMember &&
        (projectMember.role === ProjectMemberRole.OWNER ||
          projectMember.role === ProjectMemberRole.EDITOR);
      if (!writeOrg && !writeProj) {
        throw new ForbiddenException('Insufficient project role');
      }
    }
    return project;
  }

  private computeProgress(
    stages: Array<{ status: ProjectStageStatus; progressPct: number }>,
  ): number {
    if (!stages.length) return 0;
    const done = stages.filter((s) => s.status === ProjectStageStatus.DONE).length;
    const skipped = stages.filter((s) => s.status === ProjectStageStatus.SKIPPED).length;
    const active = stages.find((s) => s.status === ProjectStageStatus.ACTIVE);
    const base = ((done + skipped) / stages.length) * 100;
    const activeBoost = active ? (active.progressPct / stages.length) : 0;
    return Math.round(Math.min(100, base + activeBoost));
  }

  private toListDto(
    p: {
      id: string;
      publicId: string;
      name: string;
      projectTypeCode: string | null;
      estimatedCompletionDate: Date | null;
      currentStageCode: string | null;
      status: ProjectStatus;
      address: { city: string; province: string | null } | null;
      stages: Array<{ status: ProjectStageStatus; progressPct: number }>;
      requirements: Array<{ status: ProjectRequirementStatus }>;
    },
    locale: string,
  ) {
    const openProcurement = p.requirements.filter((r) =>
      ['PLANNED', 'SOURCING', 'RFQ_OPEN'].includes(r.status),
    ).length;
    return {
      id: p.id,
      publicId: p.publicId,
      name: p.name,
      projectTypeCode: p.projectTypeCode,
      city: p.address?.city || null,
      province: p.address?.province || null,
      currentStageCode: p.currentStageCode,
      currentStageLabel: p.currentStageCode
        ? projectStageLabel(p.currentStageCode, locale)
        : null,
      progressPct: this.computeProgress(p.stages),
      status: p.status,
      estimatedCompletionDate: p.estimatedCompletionDate,
      openProcurementCount: openProcurement,
    };
  }

  private async getRequirementDto(id: string, locale: string) {
    const r = await this.prisma.projectRequirement.findUnique({
      where: { id },
      include: {
        category: { select: { id: true, slug: true, nameEn: true, nameFa: true } },
        listing: {
          select: {
            id: true,
            publicId: true,
            slug: true,
            title: true,
            leadTimeDays: true,
            status: true,
          },
        },
        rfq: { select: { id: true, publicId: true, status: true } },
        quote: { select: { id: true, publicId: true, status: true } },
        order: { select: { id: true, publicId: true, status: true } },
        professionalLead: {
          select: { id: true, publicId: true, status: true, specialtyHints: true },
        },
      },
    });
    if (!r) throw new NotFoundException('Requirement not found');
    return this.toRequirementDto(r, locale);
  }

  private toRequirementDto(
    r: {
      id: string;
      publicId: string;
      stageCode: string | null;
      kind: ProjectRequirementKind;
      title: string;
      description: string | null;
      specialtyCode: string | null;
      quantity: Prisma.Decimal | number | null;
      uomCode: string | null;
      needByDate: Date | null;
      procurementTargetDate: Date | null;
      verifiedLeadTimeDays: number | null;
      leadTimeSource: ProjectLeadTimeSource;
      status: ProjectRequirementStatus;
      source: ProjectRequirementSource;
      category?: { id: string; slug: string; nameEn: string; nameFa: string | null } | null;
      listing?: {
        id: string;
        publicId: string;
        slug: string;
        title: string;
        leadTimeDays: number | null;
        status: string;
      } | null;
      rfq?: { id: string; publicId: string; status: string } | null;
      quote?: { id: string; publicId: string; status: string } | null;
      order?: { id: string; publicId: string; status: string } | null;
      professionalLead?: {
        id: string;
        publicId: string;
        status: string;
        specialtyHints: string[];
      } | null;
    },
    locale: string,
  ) {
    const recommendedRfqDate = computeRecommendedRfqDate(
      r.needByDate,
      r.verifiedLeadTimeDays,
    );
    return {
      id: r.id,
      publicId: r.publicId,
      stageCode: r.stageCode,
      stageLabel: r.stageCode ? projectStageLabel(r.stageCode, locale) : null,
      kind: r.kind,
      title: r.title,
      description: r.description,
      specialtyCode: r.specialtyCode,
      quantity: r.quantity != null ? Number(r.quantity) : null,
      uomCode: r.uomCode,
      needByDate: r.needByDate,
      procurementTargetDate: r.procurementTargetDate,
      recommendedRfqDate,
      verifiedLeadTimeDays: r.verifiedLeadTimeDays,
      leadTimeSource: r.leadTimeSource,
      leadTimeVerified: r.leadTimeSource === 'LISTING' || r.leadTimeSource === 'QUOTE',
      status: r.status,
      source: r.source,
      category: r.category
        ? {
            id: r.category.id,
            slug: r.category.slug,
            name: locale === 'en' ? r.category.nameEn : r.category.nameFa || r.category.nameEn,
          }
        : null,
      listing: r.listing || null,
      rfq: r.rfq || null,
      quote: r.quote || null,
      order: r.order || null,
      professionalLead: r.professionalLead || null,
    };
  }
}

function parseDate(value?: string | null): Date | null {
  if (value == null || value === '') return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new BadRequestException('Invalid date');
  return d;
}
