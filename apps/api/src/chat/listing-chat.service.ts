import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ChatEscalationStatus,
  ChatSenderRole,
  ListingStatus,
  PlatformRole,
} from '@prisma/client';
import { randomBytes } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { AiGatewayService } from '../ai/ai-gateway.service';
import { OrgAccessService } from '../common/org-access.service';
import { PrismaService } from '../prisma/prisma.service';
import { buildListingAssistantOutcome } from './listing-chat.assistant';
import {
  detectChatLanguage,
  isPersianLocale,
  normalizeChatLocale,
  prepareAssistantMessageBodies,
  prepareBuyerMessageBodies,
  prepareStaffMessageBodies,
} from './listing-chat.i18n';

const SUPPORT_ROLES: PlatformRole[] = [
  PlatformRole.SUPER_ADMIN,
  PlatformRole.ADMIN,
  PlatformRole.SUPPORT,
];

type ChatAudience = 'buyer' | 'staff';

@Injectable()
export class ListingChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orgAccess: OrgAccessService,
    private readonly ai: AiGatewayService,
  ) {}

  async startOrGetThread(input: {
    listingSlugOrId: string;
    userId?: string | null;
    guestName?: string | null;
    guestPhone?: string | null;
    guestToken?: string | null;
    locale?: string | null;
    firstMessage?: string | null;
  }) {
    const listing = await this.findPublishedListing(input.listingSlugOrId);
    const body = (input.firstMessage || '').trim();
    const pageLocale = normalizeChatLocale(input.locale);

    let thread = null as Awaited<ReturnType<typeof this.prisma.listingChatThread.findFirst>>;

    if (input.userId) {
      thread = await this.prisma.listingChatThread.findFirst({
        where: { listingId: listing.id, buyerUserId: input.userId },
        orderBy: { updatedAt: 'desc' },
      });
    } else if (input.guestToken) {
      thread = await this.prisma.listingChatThread.findFirst({
        where: { listingId: listing.id, guestToken: input.guestToken },
      });
    }

    if (!thread) {
      const guestName = (input.guestName || '').trim();
      if (!input.userId && guestName.length < 2) {
        throw new BadRequestException('guestName required (min 2 chars) when not logged in');
      }
      thread = await this.prisma.listingChatThread.create({
        data: {
          listingId: listing.id,
          sellerOrganizationId: listing.organizationId,
          buyerUserId: input.userId || null,
          guestName: input.userId ? null : guestName,
          guestPhone: input.userId ? null : (input.guestPhone || null)?.trim() || null,
          guestToken: input.userId ? null : randomBytes(24).toString('hex'),
          buyerLocale: pageLocale || 'fa',
        },
      });

      const welcomeFa = `گفتگو درباره «${listing.title}» شروع شد. اول دستیار پاسخ می‌دهد؛ در صورت نیاز ادمین سایت وصل می‌شود. پیام‌های غیر فارسی برای تیم به فارسی ترجمه می‌شوند.`;
      const welcomeEn = `Chat started about “${listing.title}”. Assistant replies first; site admin joins if needed. Non-Persian messages are translated to Persian for our team.`;
      const welcomeBodies = await prepareAssistantMessageBodies(
        this.ai,
        welcomeFa,
        pageLocale || 'fa',
      );
      const welcomeForBuyer =
        welcomeBodies.translated || isPersianLocale(pageLocale)
          ? welcomeBodies.bodyForBuyer
          : welcomeEn;
      await this.prisma.listingChatMessage.create({
        data: {
          threadId: thread.id,
          senderRole: ChatSenderRole.SYSTEM,
          body: welcomeForBuyer,
          bodyFa: welcomeBodies.bodyFa,
          bodyForBuyer: welcomeForBuyer,
          sourceLang: 'fa',
        },
      });
    } else if (!thread.buyerLocale && pageLocale) {
      thread = await this.prisma.listingChatThread.update({
        where: { id: thread.id },
        data: { buyerLocale: pageLocale },
      });
    }

    if (body) {
      await this.appendBuyerMessage({
        threadPublicId: thread.publicId,
        userId: input.userId,
        guestToken: thread.guestToken,
        body,
        locale: input.locale,
      });
    }

    return this.getThreadPublic(thread.publicId, {
      userId: input.userId,
      guestToken: thread.guestToken,
    });
  }

  async getThreadPublic(
    publicId: string,
    access: { userId?: string | null; guestToken?: string | null },
  ) {
    const thread = await this.prisma.listingChatThread.findUnique({
      where: { publicId },
      include: {
        listing: {
          select: {
            id: true,
            slug: true,
            title: true,
            organizationId: true,
            organization: { select: { name: true } },
          },
        },
        messages: { orderBy: { createdAt: 'asc' }, take: 200 },
      },
    });
    if (!thread) throw new NotFoundException('Thread not found');
    await this.assertThreadAccess(thread, access);
    const audience = await this.resolveAudience(thread, access);
    return this.serializeThread(thread, audience);
  }

  async appendBuyerMessage(input: {
    threadPublicId: string;
    userId?: string | null;
    guestToken?: string | null;
    body: string;
    locale?: string | null;
  }) {
    const body = (input.body || '').trim();
    if (body.length < 1 || body.length > 2000) {
      throw new BadRequestException('Message must be 1–2000 characters');
    }

    const thread = await this.prisma.listingChatThread.findUnique({
      where: { publicId: input.threadPublicId },
      include: {
        listing: {
          include: {
            price: true,
            inventory: true,
            facility: { include: { address: true } },
            organization: { select: { name: true } },
            category: { select: { nameFa: true, nameEn: true } },
          },
        },
      },
    });
    if (!thread) throw new NotFoundException('Thread not found');
    await this.assertThreadAccess(thread, input);

    const prepared = await prepareBuyerMessageBodies(this.ai, body, input.locale || thread.buyerLocale);
    const detectedLocale = prepared.sourceLang;
    const nextBuyerLocale =
      !isPersianLocale(detectedLocale)
        ? detectedLocale
        : normalizeChatLocale(thread.buyerLocale || input.locale || 'fa');

    const buyerMsg = await this.prisma.listingChatMessage.create({
      data: {
        threadId: thread.id,
        senderRole: ChatSenderRole.BUYER,
        senderUserId: input.userId || null,
        body,
        bodyFa: prepared.bodyFa,
        bodyForBuyer: prepared.bodyForBuyer,
        sourceLang: prepared.sourceLang,
      },
    });

    // Assistant: FA for staff + EN template fallback when OpenAI translation is off.
    const listingFacts = {
      ...thread.listing,
      facility: thread.listing.facility
        ? {
            city: thread.listing.facility.address?.city ?? null,
            province: thread.listing.facility.address?.province ?? null,
          }
        : null,
    };
    const outcomeFa = buildListingAssistantOutcome(listingFacts, prepared.bodyFa, 'fa');
    const outcomeEn = buildListingAssistantOutcome(listingFacts, body, 'en');
    const shouldEscalate = outcomeFa.shouldEscalate || outcomeEn.shouldEscalate;
    const escalationReason = outcomeFa.escalationReason || outcomeEn.escalationReason;
    const replyFa = outcomeFa.reply || outcomeEn.reply;

    let assistantMsg = null as typeof buyerMsg | null;
    if (replyFa) {
      const localized = await prepareAssistantMessageBodies(this.ai, replyFa, nextBuyerLocale);
      const bodyForBuyer =
        localized.translated || isPersianLocale(nextBuyerLocale)
          ? localized.bodyForBuyer
          : outcomeEn.reply || localized.bodyForBuyer;
      assistantMsg = await this.prisma.listingChatMessage.create({
        data: {
          threadId: thread.id,
          senderRole: ChatSenderRole.ASSISTANT,
          body: bodyForBuyer,
          bodyFa: localized.bodyFa,
          bodyForBuyer,
          sourceLang: 'fa',
        },
      });
    }

    const threadPatch: {
      lastMessageAt: Date;
      buyerLocale?: string;
      escalationStatus?: ChatEscalationStatus;
      escalatedAt?: Date;
      escalationReason?: string | null;
    } = {
      lastMessageAt: new Date(),
      buyerLocale: nextBuyerLocale,
    };

    if (shouldEscalate && thread.escalationStatus !== ChatEscalationStatus.OPEN) {
      threadPatch.escalationStatus = ChatEscalationStatus.OPEN;
      threadPatch.escalatedAt = new Date();
      threadPatch.escalationReason = escalationReason;
      if (!replyFa) {
        const sysFa = 'گفتگو به پشتیبانی سایت ارجاع شد. ادمین به‌زودی پاسخ می‌دهد.';
        const localized = await prepareAssistantMessageBodies(this.ai, sysFa, nextBuyerLocale);
        assistantMsg = await this.prisma.listingChatMessage.create({
          data: {
            threadId: thread.id,
            senderRole: ChatSenderRole.SYSTEM,
            body: localized.bodyForBuyer,
            bodyFa: localized.bodyFa,
            bodyForBuyer: localized.bodyForBuyer,
            sourceLang: 'fa',
          },
        });
      }
    }

    await this.prisma.listingChatThread.update({
      where: { id: thread.id },
      data: threadPatch,
    });

    const audience = await this.resolveAudience(thread, input);
    return {
      buyerMessage: this.serializeMessage(buyerMsg, audience),
      assistantMessage: assistantMsg ? this.serializeMessage(assistantMsg, audience) : null,
      escalated: shouldEscalate || thread.escalationStatus === ChatEscalationStatus.OPEN,
      translation: {
        buyerSourceLang: prepared.sourceLang,
        translatedToFa: prepared.translated,
        provider: prepared.provider,
      },
      thread: await this.getThreadPublic(thread.publicId, input),
    };
  }

  async appendSellerMessage(input: {
    threadPublicId: string;
    userId: string;
    body: string;
  }) {
    const body = (input.body || '').trim();
    if (body.length < 1 || body.length > 2000) {
      throw new BadRequestException('Message must be 1–2000 characters');
    }
    const thread = await this.prisma.listingChatThread.findUnique({
      where: { publicId: input.threadPublicId },
    });
    if (!thread) throw new NotFoundException('Thread not found');
    await this.orgAccess.requireSellerWriter(input.userId, thread.sellerOrganizationId);

    const prepared = await prepareStaffMessageBodies(this.ai, body, thread.buyerLocale);
    const msg = await this.prisma.listingChatMessage.create({
      data: {
        threadId: thread.id,
        senderRole: ChatSenderRole.SELLER,
        senderUserId: input.userId,
        body,
        bodyFa: prepared.bodyFa,
        bodyForBuyer: prepared.bodyForBuyer,
        sourceLang: prepared.sourceLang,
      },
    });
    await this.prisma.listingChatThread.update({
      where: { id: thread.id },
      data: { lastMessageAt: new Date() },
    });

    return {
      message: this.serializeMessage(msg, 'staff'),
      translation: {
        buyerLocale: thread.buyerLocale || 'fa',
        translatedForBuyer: prepared.translated,
        provider: prepared.provider,
      },
      thread: await this.getThreadPublic(thread.publicId, { userId: input.userId }),
    };
  }

  async appendAdminMessage(input: {
    threadPublicId: string;
    userId: string;
    body: string;
    resolve?: boolean;
  }) {
    await this.assertSupportUser(input.userId);
    const body = (input.body || '').trim();
    if (body.length < 1 || body.length > 2000) {
      throw new BadRequestException('Message must be 1–2000 characters');
    }
    const thread = await this.prisma.listingChatThread.findUnique({
      where: { publicId: input.threadPublicId },
    });
    if (!thread) throw new NotFoundException('Thread not found');

    const prepared = await prepareStaffMessageBodies(this.ai, body, thread.buyerLocale);
    const msg = await this.prisma.listingChatMessage.create({
      data: {
        threadId: thread.id,
        senderRole: ChatSenderRole.ADMIN,
        senderUserId: input.userId,
        body,
        bodyFa: prepared.bodyFa,
        bodyForBuyer: prepared.bodyForBuyer,
        sourceLang: prepared.sourceLang,
      },
    });

    await this.prisma.listingChatThread.update({
      where: { id: thread.id },
      data: {
        lastMessageAt: new Date(),
        escalationStatus: input.resolve
          ? ChatEscalationStatus.RESOLVED
          : ChatEscalationStatus.OPEN,
        escalatedAt: thread.escalatedAt || new Date(),
        escalationReason: thread.escalationReason || 'admin_joined',
      },
    });

    return {
      message: this.serializeMessage(msg, 'staff'),
      translation: {
        buyerLocale: thread.buyerLocale || 'fa',
        translatedForBuyer: prepared.translated,
        provider: prepared.provider,
      },
      thread: await this.getThreadPublic(thread.publicId, { userId: input.userId }),
    };
  }

  async appendMediaMessage(input: {
    threadPublicId: string;
    userId?: string | null;
    guestToken?: string | null;
    role: 'BUYER' | 'SELLER' | 'ADMIN';
    caption?: string | null;
    locale?: string | null;
    file: { buffer: Buffer; mimetype: string; originalname: string; size: number };
  }) {
    const thread = await this.prisma.listingChatThread.findUnique({
      where: { publicId: input.threadPublicId },
    });
    if (!thread) throw new NotFoundException('Thread not found');

    if (input.role === 'BUYER') {
      await this.assertThreadAccess(thread, input);
    } else if (input.role === 'SELLER') {
      if (!input.userId) throw new ForbiddenException('Seller auth required');
      await this.orgAccess.requireSellerWriter(input.userId, thread.sellerOrganizationId);
    } else {
      if (!input.userId) throw new ForbiddenException('Admin auth required');
      await this.assertSupportUser(input.userId);
    }

    const mime = (input.file.mimetype || '').toLowerCase();
    const isImage = mime.startsWith('image/');
    const isVideo = mime.startsWith('video/');
    if (!isImage && !isVideo) {
      throw new BadRequestException('Only image or video files are allowed');
    }
    const max = isVideo ? 40 * 1024 * 1024 : 8 * 1024 * 1024;
    if (input.file.size > max) {
      throw new BadRequestException(isVideo ? 'Video too large (max 40MB)' : 'Image too large (max 8MB)');
    }

    const ext =
      (input.file.originalname.split('.').pop() || (isVideo ? 'mp4' : 'jpg'))
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '') || (isVideo ? 'mp4' : 'jpg');
    const name = `${Date.now()}-${randomBytes(6).toString('hex')}.${ext}`;
    const dir = join(process.cwd(), 'uploads', 'chat');
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, name), input.file.buffer);
    const mediaUrl = `/api/uploads/chat/${name}`;
    const mediaType = isVideo ? 'VIDEO' : 'IMAGE';

    const caption = (input.caption || '').trim().slice(0, 2000);
    const defaultBody =
      caption ||
      (isVideo
        ? input.locale === 'en'
          ? 'Video'
          : 'ویدیو'
        : input.locale === 'en'
          ? 'Photo'
          : 'عکس');

    let body = defaultBody;
    let bodyFa = defaultBody;
    let bodyForBuyer = defaultBody;
    let sourceLang = 'fa';

    if (input.role === 'BUYER' && caption) {
      const prepared = await prepareBuyerMessageBodies(this.ai, caption, input.locale || thread.buyerLocale);
      body = caption;
      bodyFa = prepared.bodyFa;
      bodyForBuyer = prepared.bodyForBuyer;
      sourceLang = prepared.sourceLang;
      if (!isPersianLocale(prepared.sourceLang)) {
        await this.prisma.listingChatThread.update({
          where: { id: thread.id },
          data: { buyerLocale: prepared.sourceLang },
        });
      }
    } else if ((input.role === 'SELLER' || input.role === 'ADMIN') && caption) {
      const prepared = await prepareStaffMessageBodies(this.ai, caption, thread.buyerLocale);
      body = caption;
      bodyFa = prepared.bodyFa;
      bodyForBuyer = prepared.bodyForBuyer;
      sourceLang = 'fa';
    }

    const senderRole =
      input.role === 'BUYER'
        ? ChatSenderRole.BUYER
        : input.role === 'SELLER'
          ? ChatSenderRole.SELLER
          : ChatSenderRole.ADMIN;

    const msg = await this.prisma.listingChatMessage.create({
      data: {
        threadId: thread.id,
        senderRole,
        senderUserId: input.userId || null,
        body,
        bodyFa,
        bodyForBuyer,
        sourceLang,
        mediaUrl,
        mediaType,
        mediaMime: mime,
      },
    });

    await this.prisma.listingChatThread.update({
      where: { id: thread.id },
      data: {
        lastMessageAt: new Date(),
        ...(input.role === 'ADMIN'
          ? {
              escalationStatus: ChatEscalationStatus.OPEN,
              escalatedAt: thread.escalatedAt || new Date(),
              escalationReason: thread.escalationReason || 'admin_joined',
            }
          : {}),
      },
    });

    const audience =
      input.role === 'BUYER' ? await this.resolveAudience(thread, input) : ('staff' as const);
    return {
      message: this.serializeMessage(msg, audience),
      thread: await this.getThreadPublic(thread.publicId, {
        userId: input.userId,
        guestToken: input.guestToken,
      }),
    };
  }

  async resolveEscalation(userId: string, threadPublicId: string) {
    await this.assertSupportUser(userId);
    const thread = await this.prisma.listingChatThread.findUnique({
      where: { publicId: threadPublicId },
    });
    if (!thread) throw new NotFoundException('Thread not found');
    await this.prisma.listingChatThread.update({
      where: { id: thread.id },
      data: { escalationStatus: ChatEscalationStatus.RESOLVED },
    });
    return this.getThreadPublic(thread.publicId, { userId });
  }

  async listSellerThreads(userId: string, organizationId: string) {
    await this.orgAccess.requireSellerMember(userId, organizationId);
    const threads = await this.prisma.listingChatThread.findMany({
      where: { sellerOrganizationId: organizationId },
      orderBy: [{ lastMessageAt: 'desc' }, { updatedAt: 'desc' }],
      take: 50,
      include: {
        listing: { select: { id: true, slug: true, title: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        _count: { select: { messages: true } },
      },
    });
    return threads.map((t) => ({
      publicId: t.publicId,
      listing: t.listing,
      guestName: t.guestName,
      buyerUserId: t.buyerUserId,
      buyerLocale: t.buyerLocale,
      lastMessageAt: t.lastMessageAt,
      messageCount: t._count.messages,
      escalationStatus: t.escalationStatus,
      preview: (t.messages[0]?.bodyFa || t.messages[0]?.body || '').slice(0, 140) || null,
    }));
  }

  async listEscalatedThreads(userId: string, status: 'OPEN' | 'RESOLVED' | 'ALL' = 'OPEN') {
    await this.assertSupportUser(userId);
    const where =
      status === 'ALL'
        ? { escalationStatus: { not: ChatEscalationStatus.NONE } }
        : {
            escalationStatus:
              status === 'RESOLVED' ? ChatEscalationStatus.RESOLVED : ChatEscalationStatus.OPEN,
          };

    const threads = await this.prisma.listingChatThread.findMany({
      where,
      orderBy: [{ escalatedAt: 'desc' }, { lastMessageAt: 'desc' }],
      take: 80,
      include: {
        listing: {
          select: {
            id: true,
            slug: true,
            title: true,
            organization: { select: { name: true } },
          },
        },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        _count: { select: { messages: true } },
      },
    });

    return threads.map((t) => ({
      publicId: t.publicId,
      listing: {
        id: t.listing.id,
        slug: t.listing.slug,
        title: t.listing.title,
        sellerName: t.listing.organization?.name || null,
      },
      guestName: t.guestName,
      guestPhone: t.guestPhone,
      buyerUserId: t.buyerUserId,
      buyerLocale: t.buyerLocale,
      escalationStatus: t.escalationStatus,
      escalationReason: t.escalationReason,
      escalatedAt: t.escalatedAt,
      lastMessageAt: t.lastMessageAt,
      messageCount: t._count.messages,
      preview: (t.messages[0]?.bodyFa || t.messages[0]?.body || '').slice(0, 160) || null,
    }));
  }

  private async findPublishedListing(slugOrId: string) {
    const listing = await this.prisma.listing.findFirst({
      where: {
        OR: [{ slug: slugOrId }, { id: slugOrId }, { publicId: slugOrId }],
        status: ListingStatus.PUBLISHED,
      },
    });
    if (!listing) throw new NotFoundException('Listing not found');
    return listing;
  }

  private async assertSupportUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { platformRole: true, isActive: true },
    });
    if (!user?.isActive || !SUPPORT_ROLES.includes(user.platformRole)) {
      throw new ForbiddenException('Support/admin role required');
    }
  }

  private async isSupportUser(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { platformRole: true, isActive: true },
    });
    return !!user?.isActive && SUPPORT_ROLES.includes(user.platformRole);
  }

  private async resolveAudience(
    thread: {
      buyerUserId: string | null;
      guestToken: string | null;
      sellerOrganizationId: string;
    },
    access: { userId?: string | null; guestToken?: string | null },
  ): Promise<ChatAudience> {
    if (access.guestToken && thread.guestToken === access.guestToken) return 'buyer';
    if (access.userId && thread.buyerUserId === access.userId) return 'buyer';
    return 'staff';
  }

  private async assertThreadAccess(
    thread: {
      buyerUserId: string | null;
      guestToken: string | null;
      sellerOrganizationId: string;
    },
    access: { userId?: string | null; guestToken?: string | null },
  ) {
    if (access.userId && thread.buyerUserId === access.userId) return;
    if (access.guestToken && thread.guestToken === access.guestToken) return;
    if (access.userId) {
      if (await this.isSupportUser(access.userId)) return;
      try {
        await this.orgAccess.requireSellerMember(access.userId, thread.sellerOrganizationId);
        return;
      } catch {
        /* fall through */
      }
    }
    throw new ForbiddenException('No access to this chat');
  }

  private serializeThread(
    thread: {
      publicId: string;
      guestToken: string | null;
      guestName: string | null;
      guestPhone: string | null;
      buyerUserId: string | null;
      buyerLocale?: string | null;
      lastMessageAt: Date | null;
      escalationStatus?: ChatEscalationStatus;
      escalatedAt?: Date | null;
      escalationReason?: string | null;
      listing: {
        id: string;
        slug: string;
        title: string;
        organization?: { name: string } | null;
      };
      messages: Array<{
        id: string;
        senderRole: ChatSenderRole;
        senderUserId: string | null;
        body: string;
        bodyFa?: string | null;
        bodyForBuyer?: string | null;
        sourceLang?: string | null;
        createdAt: Date;
      }>;
    },
    audience: ChatAudience,
  ) {
    return {
      publicId: thread.publicId,
      guestToken: thread.guestToken,
      guestName: thread.guestName,
      guestPhone: thread.guestPhone,
      buyerUserId: thread.buyerUserId,
      buyerLocale: thread.buyerLocale || 'fa',
      audience,
      bilingual: true,
      lastMessageAt: thread.lastMessageAt,
      escalationStatus: thread.escalationStatus || ChatEscalationStatus.NONE,
      escalatedAt: thread.escalatedAt || null,
      escalationReason: thread.escalationReason || null,
      listing: {
        id: thread.listing.id,
        slug: thread.listing.slug,
        title: thread.listing.title,
        sellerName: thread.listing.organization?.name || null,
      },
      messages: thread.messages.map((m) => this.serializeMessage(m, audience)),
    };
  }

  private serializeMessage(
    m: {
      id: string;
      senderRole: ChatSenderRole;
      senderUserId: string | null;
      body: string;
      bodyFa?: string | null;
      bodyForBuyer?: string | null;
      sourceLang?: string | null;
      mediaUrl?: string | null;
      mediaType?: string | null;
      mediaMime?: string | null;
      createdAt: Date;
    },
    audience: ChatAudience,
  ) {
    const bodyFa = m.bodyFa || m.body;
    const bodyForBuyer = m.bodyForBuyer || m.body;
    const text = audience === 'staff' ? bodyFa : bodyForBuyer;
    const showOriginal =
      audience === 'staff' &&
      m.senderRole === ChatSenderRole.BUYER &&
      m.sourceLang &&
      !isPersianLocale(m.sourceLang) &&
      m.body !== bodyFa;

    return {
      id: m.id,
      senderRole: m.senderRole,
      senderUserId: m.senderUserId,
      /** Preferred display text for this audience */
      text,
      body: m.body,
      bodyFa,
      bodyForBuyer,
      sourceLang: m.sourceLang || detectChatLanguage(m.body || 'fa'),
      original: showOriginal ? m.body : null,
      mediaUrl: m.mediaUrl || null,
      mediaType: m.mediaType || null,
      mediaMime: m.mediaMime || null,
      createdAt: m.createdAt,
    };
  }
}
