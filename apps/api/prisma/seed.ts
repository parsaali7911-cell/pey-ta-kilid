import { config as loadDotenv } from 'dotenv';
import { resolve } from 'path';
import * as bcrypt from 'bcryptjs';
import {
  AttributeDataType,
  CurrencyCode,
  FacilityType,
  MarketCode,
  PlatformRole,
  PriceType,
  PrismaClient,
  TextDirection,
} from '@prisma/client';

loadDotenv({ path: resolve(__dirname, '../../../.env') });

const prisma = new PrismaClient();

async function upsertCategory(input: {
  slug: string;
  nameEn: string;
  nameFa: string;
  nameAr?: string;
  parentId?: string | null;
  sortOrder?: number;
}) {
  return prisma.category.upsert({
    where: { slug: input.slug },
    update: {
      nameEn: input.nameEn,
      nameFa: input.nameFa,
      nameAr: input.nameAr ?? null,
      parentId: input.parentId ?? null,
      isActive: true,
      sortOrder: input.sortOrder ?? 0,
    },
    create: {
      slug: input.slug,
      nameEn: input.nameEn,
      nameFa: input.nameFa,
      nameAr: input.nameAr ?? null,
      parentId: input.parentId ?? null,
      sortOrder: input.sortOrder ?? 0,
    },
  });
}

async function upsertAttr(
  categoryId: string,
  def: {
    code: string;
    dataType: AttributeDataType;
    nameEn: string;
    nameFa: string;
    unit?: string;
    required?: boolean;
    filterable?: boolean;
    enumOptions?: string[];
    facetOrder?: number;
  },
) {
  return prisma.attributeDefinition.upsert({
    where: { categoryId_code: { categoryId, code: def.code } },
    update: {
      dataType: def.dataType,
      nameEn: def.nameEn,
      nameFa: def.nameFa,
      unit: def.unit,
      required: def.required ?? false,
      filterable: def.filterable ?? true,
      facetable: def.filterable ?? true,
      enumOptions: def.enumOptions,
      facetOrder: def.facetOrder,
      isActive: true,
      inheritToChildren: true,
    },
    create: {
      categoryId,
      code: def.code,
      dataType: def.dataType,
      nameEn: def.nameEn,
      nameFa: def.nameFa,
      unit: def.unit,
      required: def.required ?? false,
      filterable: def.filterable ?? true,
      facetable: def.filterable ?? true,
      enumOptions: def.enumOptions,
      facetOrder: def.facetOrder,
      inheritToChildren: true,
    },
  });
}

/** Browse-tree style taxonomy for Amazon-like seller listing (Peytakilid content). */
async function seedCatalogTaxonomy() {
  const materials = await upsertCategory({
    slug: 'materials',
    nameEn: 'Building Materials',
    nameFa: 'مصالح ساختمانی',
    nameAr: 'مواد البناء',
    sortOrder: 0,
  });
  const flooring = await upsertCategory({
    slug: 'flooring',
    nameEn: 'Flooring',
    nameFa: 'کفپوش',
    parentId: materials.id,
    sortOrder: 1,
  });
  const wall = await upsertCategory({
    slug: 'wall-finishes',
    nameEn: 'Wall Finishes',
    nameFa: 'پوشش دیوار',
    parentId: materials.id,
    sortOrder: 2,
  });
  const structural = await upsertCategory({
    slug: 'structural',
    nameEn: 'Structural',
    nameFa: 'سازه‌ای',
    parentId: materials.id,
    sortOrder: 3,
  });
  const openings = await upsertCategory({
    slug: 'doors-windows',
    nameEn: 'Doors & Windows',
    nameFa: 'در و پنجره',
    parentId: materials.id,
    sortOrder: 4,
  });

  const ceramic = await upsertCategory({
    slug: 'ceramic-tile',
    nameEn: 'Ceramic Tile',
    nameFa: 'سرامیک',
    parentId: flooring.id,
    sortOrder: 1,
  });
  const porcelain = await upsertCategory({
    slug: 'porcelain-tile',
    nameEn: 'Porcelain Tile',
    nameFa: 'پرسلان',
    parentId: flooring.id,
    sortOrder: 2,
  });
  const naturalStone = await upsertCategory({
    slug: 'natural-stone',
    nameEn: 'Natural Stone',
    nameFa: 'سنگ طبیعی',
    parentId: flooring.id,
    sortOrder: 3,
  });
  const laminate = await upsertCategory({
    slug: 'laminate-flooring',
    nameEn: 'Laminate Flooring',
    nameFa: 'پارکت لمینت',
    parentId: flooring.id,
    sortOrder: 4,
  });

  const wallTile = await upsertCategory({
    slug: 'wall-tile',
    nameEn: 'Wall Tile',
    nameFa: 'کاشی دیوار',
    parentId: wall.id,
    sortOrder: 1,
  });
  const paint = await upsertCategory({
    slug: 'paint-coatings',
    nameEn: 'Paint & Coatings',
    nameFa: 'رنگ و پوشش',
    parentId: wall.id,
    sortOrder: 2,
  });

  const cement = await upsertCategory({
    slug: 'cement-concrete',
    nameEn: 'Cement & Concrete',
    nameFa: 'سیمان و بتن',
    parentId: structural.id,
    sortOrder: 1,
  });
  const steel = await upsertCategory({
    slug: 'steel-rebar',
    nameEn: 'Steel & Rebar',
    nameFa: 'فولاد و میلگرد',
    parentId: structural.id,
    sortOrder: 2,
  });

  const doors = await upsertCategory({
    slug: 'doors',
    nameEn: 'Doors',
    nameFa: 'درب',
    parentId: openings.id,
    sortOrder: 1,
  });
  const windows = await upsertCategory({
    slug: 'windows',
    nameEn: 'Windows',
    nameFa: 'پنجره',
    parentId: openings.id,
    sortOrder: 2,
  });

  const mep = await upsertCategory({
    slug: 'mep-finishes',
    nameEn: 'MEP & Finishes',
    nameFa: 'تاسیسات و نازک‌کاری',
    parentId: materials.id,
    sortOrder: 5,
  });
  const toolsRoot = await upsertCategory({
    slug: 'tools-systems',
    nameEn: 'Tools & Systems',
    nameFa: 'ابزار و سیستم‌ها',
    parentId: materials.id,
    sortOrder: 6,
  });

  const extraLeaves: Array<{
    slug: string;
    nameEn: string;
    nameFa: string;
    parentId: string;
    sortOrder: number;
  }> = [
    { slug: 'brick-block', nameEn: 'Brick & Block', nameFa: 'آجر و بلوک', parentId: structural.id, sortOrder: 3 },
    { slug: 'gypsum-plaster', nameEn: 'Gypsum & Plaster', nameFa: 'گچ و اندود', parentId: wall.id, sortOrder: 3 },
    { slug: 'insulation', nameEn: 'Insulation', nameFa: 'عایق', parentId: wall.id, sortOrder: 4 },
    { slug: 'waterproofing', nameEn: 'Waterproofing', nameFa: 'عایق رطوبتی', parentId: wall.id, sortOrder: 5 },
    { slug: 'cabinets', nameEn: 'Cabinets', nameFa: 'کابینت', parentId: openings.id, sortOrder: 3 },
    { slug: 'sanitaryware', nameEn: 'Sanitaryware', nameFa: 'چینی بهداشتی', parentId: mep.id, sortOrder: 1 },
    { slug: 'faucets-fixtures', nameEn: 'Faucets & Fixtures', nameFa: 'شیرآلات', parentId: mep.id, sortOrder: 2 },
    { slug: 'pipes-fittings', nameEn: 'Pipes & Fittings', nameFa: 'لوله و اتصالات', parentId: mep.id, sortOrder: 3 },
    { slug: 'electrical-supplies', nameEn: 'Electrical Supplies', nameFa: 'لوازم برقی', parentId: mep.id, sortOrder: 4 },
    { slug: 'lighting', nameEn: 'Lighting', nameFa: 'روشنایی', parentId: mep.id, sortOrder: 5 },
    { slug: 'hvac', nameEn: 'HVAC', nameFa: 'تاسیسات حرارتی', parentId: mep.id, sortOrder: 6 },
    { slug: 'glass-mirrors', nameEn: 'Glass & Mirrors', nameFa: 'شیشه و آینه', parentId: openings.id, sortOrder: 4 },
    { slug: 'wood-timber', nameEn: 'Wood & Timber', nameFa: 'چوب و MDF', parentId: toolsRoot.id, sortOrder: 1 },
    { slug: 'metalwork', nameEn: 'Metalwork', nameFa: 'فلزکاری', parentId: toolsRoot.id, sortOrder: 2 },
    { slug: 'scaffolding', nameEn: 'Scaffolding', nameFa: 'داربست', parentId: toolsRoot.id, sortOrder: 3 },
    { slug: 'elevators', nameEn: 'Elevators', nameFa: 'آسانسور', parentId: toolsRoot.id, sortOrder: 4 },
    { slug: 'security-systems', nameEn: 'Security Systems', nameFa: 'سیستم‌های امنیتی', parentId: toolsRoot.id, sortOrder: 5 },
    { slug: 'landscape-garden', nameEn: 'Landscape & Garden', nameFa: 'محوطه‌سازی', parentId: toolsRoot.id, sortOrder: 6 },
    { slug: 'adhesives-sealants', nameEn: 'Adhesives & Sealants', nameFa: 'چسب و درزگیر', parentId: toolsRoot.id, sortOrder: 7 },
    { slug: 'tools-hardware', nameEn: 'Tools & Hardware', nameFa: 'ابزار و یراق', parentId: toolsRoot.id, sortOrder: 8 },
    { slug: 'carpet-rugs', nameEn: 'Carpet & Rugs', nameFa: 'موکت و فرش', parentId: flooring.id, sortOrder: 5 },
  ];
  for (const leaf of extraLeaves) {
    await upsertCategory(leaf);
  }

  // Shared product attributes (Amazon-like "product details" fields)
  for (const cat of [ceramic, porcelain, naturalStone, laminate, wallTile]) {
    await upsertAttr(cat.id, {
      code: 'size_cm',
      dataType: AttributeDataType.NUMBER,
      nameEn: 'Size',
      nameFa: 'سایز',
      unit: 'cm',
      required: true,
      facetOrder: 1,
    });
    await upsertAttr(cat.id, {
      code: 'color',
      dataType: AttributeDataType.STRING,
      nameEn: 'Color',
      nameFa: 'رنگ',
      required: true,
      facetOrder: 2,
    });
    await upsertAttr(cat.id, {
      code: 'finish',
      dataType: AttributeDataType.ENUM,
      nameEn: 'Finish',
      nameFa: 'سطح',
      required: false,
      enumOptions: ['matte', 'glossy', 'polished', 'honed', 'textured'],
      facetOrder: 3,
    });
    await upsertAttr(cat.id, {
      code: 'thickness_mm',
      dataType: AttributeDataType.NUMBER,
      nameEn: 'Thickness',
      nameFa: 'ضخامت',
      unit: 'mm',
      required: false,
      facetOrder: 4,
    });
  }

  await upsertAttr(paint.id, {
    code: 'color',
    dataType: AttributeDataType.STRING,
    nameEn: 'Color',
    nameFa: 'رنگ',
    required: true,
  });
  await upsertAttr(paint.id, {
    code: 'coverage_m2_per_liter',
    dataType: AttributeDataType.NUMBER,
    nameEn: 'Coverage',
    nameFa: 'پوشش',
    unit: 'm2/L',
    required: false,
  });
  await upsertAttr(cement.id, {
    code: 'grade',
    dataType: AttributeDataType.STRING,
    nameEn: 'Grade',
    nameFa: 'عیار',
    required: true,
  });
  await upsertAttr(steel.id, {
    code: 'diameter_mm',
    dataType: AttributeDataType.NUMBER,
    nameEn: 'Diameter',
    nameFa: 'قطر',
    unit: 'mm',
    required: true,
  });
  await upsertAttr(doors.id, {
    code: 'width_cm',
    dataType: AttributeDataType.NUMBER,
    nameEn: 'Width',
    nameFa: 'عرض',
    unit: 'cm',
    required: true,
  });
  await upsertAttr(doors.id, {
    code: 'material',
    dataType: AttributeDataType.STRING,
    nameEn: 'Material',
    nameFa: 'جنس',
    required: true,
  });
  await upsertAttr(windows.id, {
    code: 'glazing',
    dataType: AttributeDataType.ENUM,
    nameEn: 'Glazing',
    nameFa: 'شیشه',
    required: true,
    enumOptions: ['single', 'double', 'triple'],
  });

  // Deactivate junk root if present
  await prisma.category.updateMany({
    where: { slug: 'p3b-root' },
    data: { isActive: false },
  });

  console.log(
    `Catalog taxonomy ready: materials → flooring/wall/structural/openings (+ leaf product types)`,
  );
}

async function seedLocales() {
  const locales = [
    {
      code: 'fa',
      nameEn: 'Persian',
      nameNative: 'فارسی',
      direction: TextDirection.RTL,
      isDefault: true,
      sortOrder: 0,
    },
    {
      code: 'en',
      nameEn: 'English',
      nameNative: 'English',
      direction: TextDirection.LTR,
      isDefault: false,
      sortOrder: 1,
    },
    {
      code: 'ar',
      nameEn: 'Arabic',
      nameNative: 'العربية',
      direction: TextDirection.RTL,
      isDefault: false,
      sortOrder: 2,
    },
  ];

  for (const locale of locales) {
    await prisma.locale.upsert({
      where: { code: locale.code },
      create: locale,
      update: {
        nameEn: locale.nameEn,
        nameNative: locale.nameNative,
        direction: locale.direction,
        isDefault: locale.isDefault,
        isActive: true,
        sortOrder: locale.sortOrder,
      },
    });
  }
}

async function seedMarkets() {
  await prisma.market.upsert({
    where: { code: MarketCode.IRAN },
    create: {
      code: MarketCode.IRAN,
      nameEn: 'Iran Domestic',
      defaultCurrency: CurrencyCode.IRR,
      allowedCurrencies: [CurrencyCode.IRR, CurrencyCode.USD, CurrencyCode.EUR, CurrencyCode.AED],
      allowedIncoterms: [PriceType.EXW, PriceType.FOB, PriceType.CIF, PriceType.OTHER],
      sortOrder: 0,
    },
    update: {
      isActive: true,
      defaultCurrency: CurrencyCode.IRR,
      allowedCurrencies: [CurrencyCode.IRR, CurrencyCode.USD, CurrencyCode.EUR, CurrencyCode.AED],
      allowedIncoterms: [PriceType.EXW, PriceType.FOB, PriceType.CIF, PriceType.OTHER],
    },
  });

  await prisma.market.upsert({
    where: { code: MarketCode.INTERNATIONAL },
    create: {
      code: MarketCode.INTERNATIONAL,
      nameEn: 'International / Export',
      defaultCurrency: CurrencyCode.USD,
      allowedCurrencies: [CurrencyCode.USD, CurrencyCode.EUR, CurrencyCode.AED, CurrencyCode.GBP, CurrencyCode.IRR],
      allowedIncoterms: [
        PriceType.EXW,
        PriceType.FOB,
        PriceType.CIF,
        PriceType.CFR,
        PriceType.DAP,
        PriceType.DDP,
        PriceType.OTHER,
      ],
      sortOrder: 1,
    },
    update: {
      isActive: true,
      defaultCurrency: CurrencyCode.USD,
      allowedCurrencies: [CurrencyCode.USD, CurrencyCode.EUR, CurrencyCode.AED, CurrencyCode.GBP, CurrencyCode.IRR],
      allowedIncoterms: [
        PriceType.EXW,
        PriceType.FOB,
        PriceType.CIF,
        PriceType.CFR,
        PriceType.DAP,
        PriceType.DDP,
        PriceType.OTHER,
      ],
    },
  });
}

async function main() {
  await seedLocales();
  await seedMarkets();
  await seedCatalogTaxonomy();

  const email = (process.env.BOOTSTRAP_ADMIN_EMAIL || 'admin@peytakilid.local').toLowerCase();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD || 'ChangeMeAdmin123!';
  const passwordHash = await bcrypt.hash(password, 10);

  const admin = await prisma.user.upsert({
    where: { email },
    update: {
      platformRole: PlatformRole.SUPER_ADMIN,
      isActive: true,
      passwordHash,
      fullName: 'Peytakilid Super Admin',
    },
    create: {
      email,
      passwordHash,
      fullName: 'Peytakilid Super Admin',
      platformRole: PlatformRole.SUPER_ADMIN,
    },
  });

  console.log(`Locales + markets seeded; SUPER_ADMIN ready: ${admin.email}`);

  const sellerEmail = 'seller@peytakilid.local';
  const sellerPassword = 'ChangeMeSeller123!';
  const sellerHash = await bcrypt.hash(sellerPassword, 10);
  const seller = await prisma.user.upsert({
    where: { email: sellerEmail },
    update: {
      isActive: true,
      passwordHash: sellerHash,
      fullName: 'Demo Factory Seller',
      platformRole: PlatformRole.USER,
    },
    create: {
      email: sellerEmail,
      passwordHash: sellerHash,
      fullName: 'Demo Factory Seller',
      platformRole: PlatformRole.USER,
    },
  });
  console.log(`Demo seller ready: ${seller.email} / ${sellerPassword}`);

  const buyerEmail = 'buyer@peytakilid.local';
  const buyerPassword = 'ChangeMeBuyer123!';
  const buyerHash = await bcrypt.hash(buyerPassword, 10);
  const buyer = await prisma.user.upsert({
    where: { email: buyerEmail },
    update: {
      isActive: true,
      passwordHash: buyerHash,
      fullName: 'Demo Project Buyer',
      platformRole: PlatformRole.USER,
    },
    create: {
      email: buyerEmail,
      passwordHash: buyerHash,
      fullName: 'Demo Project Buyer',
      platformRole: PlatformRole.USER,
    },
  });
  console.log(`Demo buyer ready: ${buyer.email} / ${buyerPassword}`);

  const buyerOrg = await prisma.organization.upsert({
    where: { slug: 'demo-buyer-project' },
    update: {
      name: 'Demo Project Buyer',
      canBuy: true,
      canSell: false,
      isProfessional: false,
      isActive: true,
    },
    create: {
      name: 'Demo Project Buyer',
      slug: 'demo-buyer-project',
      canBuy: true,
      canSell: false,
      isProfessional: false,
    },
  });
  await prisma.organizationMember.upsert({
    where: {
      userId_organizationId: { userId: buyer.id, organizationId: buyerOrg.id },
    },
    update: { orgRole: 'ORG_OWNER' },
    create: {
      organizationId: buyerOrg.id,
      userId: buyer.id,
      orgRole: 'ORG_OWNER',
    },
  });
  console.log(`Demo buyer org ready: ${buyerOrg.slug}`);

  await seedLocatedOrgs(seller);
}

async function ensureOrgLocation(input: {
  orgId: string;
  city: string;
  specialty?: string | null;
  facilityName: string;
  facilityType: FacilityType;
}) {
  const { resolveIranPlace } = await import('../src/geo/iran-place');
  const place = resolveIranPlace(input.city);
  if (!place) return;

  await prisma.organization.update({
    where: { id: input.orgId },
    data: { primarySpecialty: input.specialty ?? undefined },
  });

  const existing = await prisma.facility.findFirst({
    where: { organizationId: input.orgId, isPublicLocation: true },
  });
  if (existing) return;

  const address = await prisma.address.create({
    data: {
      countryCode: place.countryCode,
      province: place.province || undefined,
      city: place.city,
      line1: place.cityFa || place.city,
    },
  });
  const geo = await prisma.geoPoint.create({
    data: {
      latitude: place.latitude,
      longitude: place.longitude,
      accuracyM: 5000,
    },
  });
  await prisma.facility.create({
    data: {
      organizationId: input.orgId,
      name: input.facilityName,
      type: input.facilityType,
      isPublicLocation: true,
      addressId: address.id,
      geoPointId: geo.id,
    },
  });
  const center = await prisma.geoPoint.create({
    data: { latitude: place.latitude, longitude: place.longitude, accuracyM: 5000 },
  });
  await prisma.serviceArea.create({
    data: {
      organizationId: input.orgId,
      name: `${place.city}, ${place.province || ''}`.trim(),
      countryCode: place.countryCode,
      province: place.province || undefined,
      city: place.city,
      centerPointId: center.id,
      radiusKm: 50,
      isActive: true,
    },
  });
}

async function seedLocatedOrgs(seller: { id: string }) {
  const sellerOrg = await prisma.organization.upsert({
    where: { slug: 'demo-tehran-ceramics' },
    update: {
      name: 'Demo Tehran Ceramics',
      canSell: true,
      canBuy: true,
      isProfessional: false,
      isActive: true,
      primarySpecialty: null,
    },
    create: {
      name: 'Demo Tehran Ceramics',
      slug: 'demo-tehran-ceramics',
      canSell: true,
      canBuy: true,
      isProfessional: false,
    },
  });
  await prisma.organizationMember.upsert({
    where: { userId_organizationId: { userId: seller.id, organizationId: sellerOrg.id } },
    update: { orgRole: 'ORG_OWNER' },
    create: { userId: seller.id, organizationId: sellerOrg.id, orgRole: 'ORG_OWNER' },
  });
  await ensureOrgLocation({
    orgId: sellerOrg.id,
    city: 'Tehran',
    facilityName: 'کارخانه تهران',
    facilityType: FacilityType.FACTORY,
  });

  const pros: Array<{ slug: string; name: string; city: string; specialty: string }> = [
    { slug: 'demo-rasht-tiler', name: 'سرامیک‌کار رشت', city: 'Rasht', specialty: 'tile_installation' },
    { slug: 'demo-zanjan-plasterer', name: 'گچ‌کار زنجان', city: 'Zanjan', specialty: 'plastering' },
    { slug: 'demo-qeshm-painter', name: 'نقاش قشم', city: 'Qeshm', specialty: 'painting' },
    { slug: 'demo-borujerd-welder', name: 'جوشکار بروجرد', city: 'Borujerd', specialty: 'welding' },
    { slug: 'demo-sanandaj-cabinet', name: 'کابینت‌ساز سنندج', city: 'Sanandaj', specialty: 'cabinet_making' },
  ];

  for (const p of pros) {
    const org = await prisma.organization.upsert({
      where: { slug: p.slug },
      update: {
        name: p.name,
        canSell: true,
        canBuy: false,
        isProfessional: true,
        isActive: true,
        primarySpecialty: p.specialty,
      },
      create: {
        name: p.name,
        slug: p.slug,
        canSell: true,
        canBuy: false,
        isProfessional: true,
        primarySpecialty: p.specialty,
      },
    });
    await prisma.organizationMember.upsert({
      where: { userId_organizationId: { userId: seller.id, organizationId: org.id } },
      update: { orgRole: 'ORG_OWNER' },
      create: { userId: seller.id, organizationId: org.id, orgRole: 'ORG_OWNER' },
    });
    await ensureOrgLocation({
      orgId: org.id,
      city: p.city,
      specialty: p.specialty,
      facilityName: `${p.name} — محل خدمت`,
      facilityType: FacilityType.SERVICE_LOCATION,
    });
  }
  console.log(`Demo located seller + ${pros.length} professional orgs ready`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
