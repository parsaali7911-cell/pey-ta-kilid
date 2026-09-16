import { randomUUID } from 'crypto';
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'fs';
import { extname, join } from 'path';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MediaStatus } from '@prisma/client';
import { OrgAccessService } from '../common/org-access.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMediaDto, CreateProductDto, CreateVariantDto } from './dto/product-media.dto';

const UPLOAD_ROOT = join(process.cwd(), 'uploads', 'listings');
const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
]);

function ensureDir(path: string) {
  if (!existsSync(path)) mkdirSync(path, { recursive: true });
}

function extForMime(mime: string, originalName?: string): string {
  const fromName = originalName ? extname(originalName).toLowerCase() : '';
  if (fromName && /^\.(jpe?g|png|webp|gif)$/.test(fromName)) return fromName;
  if (mime === 'image/png') return '.png';
  if (mime === 'image/webp') return '.webp';
  if (mime === 'image/gif') return '.gif';
  return '.jpg';
}

@Injectable()
export class ProductMediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orgAccess: OrgAccessService,
  ) {}

  async createProduct(userId: string, dto: CreateProductDto) {
    if (dto.organizationId) {
      await this.orgAccess.requireSellerWriter(userId, dto.organizationId);
    }
    return this.prisma.product.create({
      data: {
        slug: dto.slug.toLowerCase(),
        name: dto.name,
        description: dto.description,
        categoryId: dto.categoryId,
        organizationId: dto.organizationId,
      },
    });
  }

  async createVariant(userId: string, productId: string, dto: CreateVariantDto) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundException('Product not found');
    if (product.organizationId) {
      await this.orgAccess.requireSellerWriter(userId, product.organizationId);
    }
    return this.prisma.productVariant.create({
      data: {
        productId,
        sku: dto.sku,
        name: dto.name,
      },
    });
  }

  async addMedia(userId: string, dto: CreateMediaDto) {
    await this.orgAccess.requireSellerWriter(userId, dto.organizationId);
    if (dto.listingId) {
      const listing = await this.prisma.listing.findUnique({ where: { id: dto.listingId } });
      if (!listing || listing.organizationId !== dto.organizationId) {
        throw new NotFoundException('Listing not found for organization');
      }
    }
    return this.prisma.mediaAsset.create({
      data: {
        organizationId: dto.organizationId,
        listingId: dto.listingId,
        storageKey: dto.storageKey,
        url: dto.url,
        mimeType: dto.mimeType,
        altText: dto.altText,
        status: MediaStatus.PENDING,
      },
    });
  }

  async listForListing(userId: string, listingId: string) {
    const listing = await this.prisma.listing.findUnique({ where: { id: listingId } });
    if (!listing) throw new NotFoundException('Listing not found');
    await this.orgAccess.requireSellerMember(userId, listing.organizationId);
    return this.prisma.mediaAsset.findMany({
      where: { listingId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async uploadForListing(
    userId: string,
    listingId: string,
    file: { buffer: Buffer; mimetype: string; originalname?: string; size: number },
    altText?: string | null,
  ) {
    const listing = await this.prisma.listing.findUnique({ where: { id: listingId } });
    if (!listing) throw new NotFoundException('Listing not found');
    await this.orgAccess.requireSellerWriter(userId, listing.organizationId);

    if (!file?.buffer?.length) throw new BadRequestException('Image file required');
    if (file.size > 8 * 1024 * 1024) throw new BadRequestException('Max image size is 8MB');
    const mime = (file.mimetype || '').toLowerCase();
    if (!ALLOWED_MIME.has(mime)) {
      throw new BadRequestException('Only JPEG, PNG, WebP, GIF images are allowed');
    }

    const dir = join(UPLOAD_ROOT, listing.organizationId);
    ensureDir(dir);
    const id = randomUUID();
    const ext = extForMime(mime, file.originalname);
    const storageKey = `listings/${listing.organizationId}/${id}${ext}`;
    const abs = join(process.cwd(), 'uploads', storageKey);
    ensureDir(join(abs, '..'));
    writeFileSync(abs, file.buffer);

    const count = await this.prisma.mediaAsset.count({ where: { listingId } });
    const url = `/api/uploads/${storageKey}`;

    return this.prisma.mediaAsset.create({
      data: {
        organizationId: listing.organizationId,
        listingId,
        storageKey,
        url,
        mimeType: mime,
        altText: altText?.trim() || listing.title,
        sortOrder: count,
        // Seller-owned listing photos are public once listing is published.
        status: MediaStatus.APPROVED,
      },
    });
  }

  async remove(userId: string, mediaId: string) {
    const media = await this.prisma.mediaAsset.findUnique({ where: { id: mediaId } });
    if (!media) throw new NotFoundException('Media not found');
    await this.orgAccess.requireSellerWriter(userId, media.organizationId);

    await this.prisma.mediaAsset.delete({ where: { id: mediaId } });

    if (media.storageKey?.startsWith('listings/')) {
      const abs = join(process.cwd(), 'uploads', media.storageKey);
      try {
        if (existsSync(abs)) unlinkSync(abs);
      } catch {
        /* ignore fs cleanup */
      }
    }

    return { ok: true, id: mediaId };
  }
}
