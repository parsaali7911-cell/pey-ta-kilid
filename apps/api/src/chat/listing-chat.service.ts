import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ChatSenderRole, ListingStatus } from '@prisma/client';
import { randomBytes } from 'crypto';
import { OrgAccessService } from '../common/org-access.service';
import { PrismaService } from '../prisma/prisma.service';
import { buildListingAssistantReply } from './listing-chat.assistant';

@Injectable()
export class ListingChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orgAccess: OrgAccessService,
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
        },
      });

      await this.prisma.listingChatMessage.create({
        data: {
          threadId: thread.id,
          senderRole: ChatSenderRole.SYSTEM,
          body:
            (input.locale || 'fa') === 'en'
              ? `Chat started about “${listing.title}”.`
              : `گفتگو درباره «${listing.title}» شروع شد.`,
        },
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
    return this.serializeThread(thread);
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

    const buyerMsg = await this.prisma.listingChatMessage.create({
      data: {
        threadId: thread.id,
        senderRole: ChatSenderRole.BUYER,
        senderUserId: input.userId || null,
        body,
      },
    });

    const listingFacts = {
      ...thread.listing,
      facility: thread.listing.facility
        ? {
            city: thread.listing.facility.address?.city ?? null,
            province: thread.listing.facility.address?.province ?? null,
          }
        : null,
    };
    const assistant = buildListingAssistantReply(
      listingFacts,
      body,
      input.locale || 'fa',
    );
    let assistantMsg = null as typeof buyerMsg | null;
    if (assistant) {
      assistantMsg = await this.prisma.listingChatMessage.create({
        data: {
          threadId: thread.id,
          senderRole: ChatSenderRole.ASSISTANT,
          body: assistant,
        },
      });
    }

    await this.prisma.listingChatThread.update({
      where: { id: thread.id },
      data: { lastMessageAt: new Date() },
    });

    return {
      buyerMessage: this.serializeMessage(buyerMsg),
      assistantMessage: assistantMsg ? this.serializeMessage(assistantMsg) : null,
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

    const msg = await this.prisma.listingChatMessage.create({
      data: {
        threadId: thread.id,
        senderRole: ChatSenderRole.SELLER,
        senderUserId: input.userId,
        body,
      },
    });
    await this.prisma.listingChatThread.update({
      where: { id: thread.id },
      data: { lastMessageAt: new Date() },
    });

    return {
      message: this.serializeMessage(msg),
      thread: await this.getThreadPublic(thread.publicId, { userId: input.userId }),
    };
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
      lastMessageAt: t.lastMessageAt,
      messageCount: t._count.messages,
      preview: t.messages[0]?.body?.slice(0, 140) || null,
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
      try {
        await this.orgAccess.requireSellerMember(access.userId, thread.sellerOrganizationId);
        return;
      } catch {
        /* fall through */
      }
    }
    throw new ForbiddenException('No access to this chat');
  }

  private serializeThread(thread: {
    publicId: string;
    guestToken: string | null;
    guestName: string | null;
    guestPhone: string | null;
    buyerUserId: string | null;
    lastMessageAt: Date | null;
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
      createdAt: Date;
    }>;
  }) {
    return {
      publicId: thread.publicId,
      guestToken: thread.guestToken,
      guestName: thread.guestName,
      guestPhone: thread.guestPhone,
      buyerUserId: thread.buyerUserId,
      lastMessageAt: thread.lastMessageAt,
      listing: {
        id: thread.listing.id,
        slug: thread.listing.slug,
        title: thread.listing.title,
        sellerName: thread.listing.organization?.name || null,
      },
      messages: thread.messages.map((m) => this.serializeMessage(m)),
    };
  }

  private serializeMessage(m: {
    id: string;
    senderRole: ChatSenderRole;
    senderUserId: string | null;
    body: string;
    createdAt: Date;
  }) {
    return {
      id: m.id,
      senderRole: m.senderRole,
      senderUserId: m.senderUserId,
      body: m.body,
      createdAt: m.createdAt,
    };
  }
}
