/**
 * Demo catalog fill: cabinets in Karaj/Tehran + electrician in Karaj.
 * Idempotent upserts by slug.
 */
import { PrismaClient, FacilityType, ListingStatus, CurrencyCode, PriceType } from '@prisma/client';

const prisma = new PrismaClient();

async function ensureFacility(orgId, city, name) {
  const place =
    city === 'Karaj'
      ? { city: 'Karaj', province: 'Alborz', lat: 35.8400, lng: 50.9391, line1: 'کرج' }
      : { city: 'Tehran', province: 'Tehran', lat: 35.6892, lng: 51.3890, line1: 'تهران' };

  const existing = await prisma.facility.findFirst({
    where: { organizationId: orgId, name },
    include: { address: true },
  });
  if (existing) return existing;

  const address = await prisma.address.create({
    data: {
      countryCode: 'IR',
      province: place.province,
      city: place.city,
      line1: place.line1,
    },
  });
  const geo = await prisma.geoPoint.create({
    data: { latitude: place.lat, longitude: place.lng, accuracyM: 5000 },
  });
  return prisma.facility.create({
    data: {
      organizationId: orgId,
      name,
      type: FacilityType.SHOWROOM,
      isPublicLocation: true,
      addressId: address.id,
      geoPointId: geo.id,
    },
  });
}

async function upsertPublishedListing({
  slug,
  orgId,
  categoryId,
  facilityId,
  title,
  description,
  uomCode,
  displayPrice,
  supplierCost,
  onHand,
  attrPairs,
}) {
  const existing = await prisma.listing.findUnique({ where: { slug } });
  if (existing) {
    await prisma.listing.update({
      where: { id: existing.id },
      data: {
        title,
        description,
        status: ListingStatus.PUBLISHED,
        publishedAt: existing.publishedAt || new Date(),
        facilityId,
        categoryId,
      },
    });
    await prisma.listingPrice.upsert({
      where: { listingId: existing.id },
      create: {
        listingId: existing.id,
        supplierCost,
        displayPrice,
        currency: CurrencyCode.IRR,
        priceType: PriceType.EXW,
        fxRateApplied: 1,
        marginPercentApplied: 10,
        flatFeeApplied: 0,
      },
      update: { displayPrice, supplierCost, currency: CurrencyCode.IRR },
    });
    await prisma.inventoryBalance.upsert({
      where: { listingId: existing.id },
      create: { listingId: existing.id, onHand, reserved: 0, uomCode },
      update: { onHand, uomCode },
    });
    return existing.id;
  }

  const listing = await prisma.listing.create({
    data: {
      slug,
      organizationId: orgId,
      categoryId,
      facilityId,
      title,
      description,
      uomCode,
      moq: 1,
      leadTimeDays: 7,
      status: ListingStatus.PUBLISHED,
      publishedAt: new Date(),
      submittedAt: new Date(),
      price: {
        create: {
          supplierCost,
          displayPrice,
          currency: CurrencyCode.IRR,
          priceType: PriceType.EXW,
          fxRateApplied: 1,
          marginPercentApplied: 10,
          flatFeeApplied: 0,
        },
      },
      inventory: {
        create: { onHand, reserved: 0, uomCode },
      },
    },
  });

  for (const [code, value] of attrPairs) {
    const def = await prisma.attributeDefinition.findFirst({
      where: { categoryId, code },
    });
    if (!def) continue;
    await prisma.attributeValue.create({
      data: {
        listingId: listing.id,
        attributeDefinitionId: def.id,
        ...(typeof value === 'number'
          ? { valueNumber: value }
          : { valueString: String(value) }),
      },
    });
  }
  return listing.id;
}

async function main() {
  const cat = await prisma.category.findUnique({ where: { slug: 'cabinets' } });
  if (!cat) throw new Error('cabinets category missing — run full seed first');

  const seller = await prisma.user.findUnique({ where: { email: 'seller@peytakilid.local' } });
  if (!seller) throw new Error('seller@peytakilid.local missing');

  const org = await prisma.organization.upsert({
    where: { slug: 'demo-karaj-cabinets' },
    update: {
      name: 'کابینت کرج دمو',
      canSell: true,
      canBuy: true,
      isActive: true,
      isProfessional: false,
    },
    create: {
      name: 'کابینت کرج دمو',
      slug: 'demo-karaj-cabinets',
      canSell: true,
      canBuy: true,
      isProfessional: false,
    },
  });
  await prisma.organizationMember.upsert({
    where: { userId_organizationId: { userId: seller.id, organizationId: org.id } },
    update: { orgRole: 'ORG_OWNER' },
    create: { userId: seller.id, organizationId: org.id, orgRole: 'ORG_OWNER' },
  });

  const facKaraj = await ensureFacility(org.id, 'Karaj', 'نمایشگاه کرج');
  const facTehran = await ensureFacility(org.id, 'Tehran', 'انبار تهران');

  const id1 = await upsertPublishedListing({
    slug: 'demo-cabinet-karaj-mdf',
    orgId: org.id,
    categoryId: cat.id,
    facilityId: facKaraj.id,
    title: 'کابینت MDF هایگلاس کرج',
    description: 'کابینت آشپزخانه MDF هایگلاس — دمو کرج',
    uomCode: 'm',
    displayPrice: 4500000,
    supplierCost: 3800000,
    onHand: 120,
    attrPairs: [
      ['material', 'mdf'],
      ['finish', 'high-gloss'],
    ],
  });
  const id2 = await upsertPublishedListing({
    slug: 'demo-cabinet-tehran-wood',
    orgId: org.id,
    categoryId: cat.id,
    facilityId: facTehran.id,
    title: 'کابینت چوب طبیعی تهران',
    description: 'کابینت چوبی — دمو تهران (برای مقایسه با کرج)',
    uomCode: 'm',
    displayPrice: 8200000,
    supplierCost: 7000000,
    onHand: 40,
    attrPairs: [
      ['material', 'solid-wood'],
      ['finish', 'natural'],
    ],
  });

  const elec = await prisma.organization.upsert({
    where: { slug: 'demo-karaj-electrician' },
    update: {
      name: 'برق‌کار کرج دمو',
      canSell: true,
      canBuy: false,
      isProfessional: true,
      isActive: true,
      primarySpecialty: 'electrical',
    },
    create: {
      name: 'برق‌کار کرج دمو',
      slug: 'demo-karaj-electrician',
      canSell: true,
      canBuy: false,
      isProfessional: true,
      primarySpecialty: 'electrical',
    },
  });
  await prisma.organizationMember.upsert({
    where: { userId_organizationId: { userId: seller.id, organizationId: elec.id } },
    update: { orgRole: 'ORG_OWNER' },
    create: { userId: seller.id, organizationId: elec.id, orgRole: 'ORG_OWNER' },
  });
  await ensureFacility(elec.id, 'Karaj', 'دفتر برق‌کار کرج');

  console.log('seeded cabinets', { id1, id2, electrician: elec.slug });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
