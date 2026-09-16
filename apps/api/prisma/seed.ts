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
import {
  SEO_LOCALES,
  autoGenerateListingSeo,
  autoGenerateProfessionalSeo,
} from '@peytakilid/shared-types';

loadDotenv({ path: resolve(__dirname, '../../../.env') });

const prisma = new PrismaClient();

async function upsertCategory(input: {
  slug: string;
  nameEn: string;
  nameFa: string;
  nameAr?: string;
  parentId?: string | null;
  sortOrder?: number;
  defaultUomCode?: string | null;
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
      ...(input.defaultUomCode !== undefined ? { defaultUomCode: input.defaultUomCode } : {}),
    },
    create: {
      slug: input.slug,
      nameEn: input.nameEn,
      nameFa: input.nameFa,
      nameAr: input.nameAr ?? null,
      parentId: input.parentId ?? null,
      sortOrder: input.sortOrder ?? 0,
      defaultUomCode: input.defaultUomCode ?? null,
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
  const extraBySlug = new Map<string, { id: string }>();
  for (const leaf of extraLeaves) {
    const row = await upsertCategory(leaf);
    extraBySlug.set(leaf.slug, row);
  }

  type AttrSeed = {
    code: string;
    dataType: AttributeDataType;
    nameEn: string;
    nameFa: string;
    unit?: string;
    required?: boolean;
    enumOptions?: string[];
    facetOrder?: number;
  };

  const tileAttrs: AttrSeed[] = [
    {
      code: 'size_cm',
      dataType: AttributeDataType.NUMBER,
      nameEn: 'Size',
      nameFa: 'سایز',
      unit: 'cm',
      required: true,
      facetOrder: 1,
    },
    {
      code: 'color',
      dataType: AttributeDataType.STRING,
      nameEn: 'Color',
      nameFa: 'رنگ',
      required: true,
      facetOrder: 2,
    },
    {
      code: 'finish',
      dataType: AttributeDataType.ENUM,
      nameEn: 'Finish',
      nameFa: 'سطح',
      required: true,
      enumOptions: ['matte', 'glossy', 'polished', 'honed', 'textured'],
      facetOrder: 3,
    },
    {
      code: 'thickness_mm',
      dataType: AttributeDataType.NUMBER,
      nameEn: 'Thickness',
      nameFa: 'ضخامت',
      unit: 'mm',
      required: false,
      facetOrder: 4,
    },
  ];

  const leafSpecs: Array<{
    slug: string;
    cat: { id: string };
    uom: string;
    attrs: AttrSeed[];
  }> = [
    { slug: 'ceramic-tile', cat: ceramic, uom: 'm2', attrs: tileAttrs },
    { slug: 'porcelain-tile', cat: porcelain, uom: 'm2', attrs: tileAttrs },
    { slug: 'natural-stone', cat: naturalStone, uom: 'm2', attrs: tileAttrs },
    {
      slug: 'laminate-flooring',
      cat: laminate,
      uom: 'm2',
      attrs: [
        {
          code: 'thickness_mm',
          dataType: AttributeDataType.NUMBER,
          nameEn: 'Thickness',
          nameFa: 'ضخامت',
          unit: 'mm',
          required: true,
          facetOrder: 1,
        },
        {
          code: 'color',
          dataType: AttributeDataType.STRING,
          nameEn: 'Color / décor',
          nameFa: 'رنگ / طرح',
          required: true,
          facetOrder: 2,
        },
        {
          code: 'wear_class',
          dataType: AttributeDataType.ENUM,
          nameEn: 'Wear class',
          nameFa: 'کلاس سایش',
          required: true,
          enumOptions: ['AC3', 'AC4', 'AC5'],
          facetOrder: 3,
        },
      ],
    },
    {
      slug: 'carpet-rugs',
      cat: extraBySlug.get('carpet-rugs')!,
      uom: 'm2',
      attrs: [
        {
          code: 'material',
          dataType: AttributeDataType.STRING,
          nameEn: 'Material',
          nameFa: 'جنس',
          required: true,
          facetOrder: 1,
        },
        {
          code: 'pile_height_mm',
          dataType: AttributeDataType.NUMBER,
          nameEn: 'Pile height',
          nameFa: 'ارتفاع پرز',
          unit: 'mm',
          required: false,
          facetOrder: 2,
        },
        {
          code: 'color',
          dataType: AttributeDataType.STRING,
          nameEn: 'Color',
          nameFa: 'رنگ',
          required: true,
          facetOrder: 3,
        },
      ],
    },
    { slug: 'wall-tile', cat: wallTile, uom: 'm2', attrs: tileAttrs },
    {
      slug: 'paint-coatings',
      cat: paint,
      uom: 'l',
      attrs: [
        {
          code: 'color',
          dataType: AttributeDataType.STRING,
          nameEn: 'Color',
          nameFa: 'رنگ',
          required: true,
          facetOrder: 1,
        },
        {
          code: 'finish_type',
          dataType: AttributeDataType.ENUM,
          nameEn: 'Finish',
          nameFa: 'نوع سطح',
          required: true,
          enumOptions: ['matte', 'semi-gloss', 'gloss', 'eggshell'],
          facetOrder: 2,
        },
        {
          code: 'coverage_m2_per_liter',
          dataType: AttributeDataType.NUMBER,
          nameEn: 'Coverage',
          nameFa: 'پوشش',
          unit: 'm2/L',
          required: false,
          facetOrder: 3,
        },
      ],
    },
    {
      slug: 'gypsum-plaster',
      cat: extraBySlug.get('gypsum-plaster')!,
      uom: 'kg',
      attrs: [
        {
          code: 'type',
          dataType: AttributeDataType.ENUM,
          nameEn: 'Type',
          nameFa: 'نوع',
          required: true,
          enumOptions: ['gypsum', 'cement-plaster', 'ready-mix'],
          facetOrder: 1,
        },
        {
          code: 'bag_weight_kg',
          dataType: AttributeDataType.NUMBER,
          nameEn: 'Bag weight',
          nameFa: 'وزن کیسه',
          unit: 'kg',
          required: true,
          facetOrder: 2,
        },
      ],
    },
    {
      slug: 'insulation',
      cat: extraBySlug.get('insulation')!,
      uom: 'm2',
      attrs: [
        {
          code: 'type',
          dataType: AttributeDataType.ENUM,
          nameEn: 'Type',
          nameFa: 'نوع',
          required: true,
          enumOptions: ['rockwool', 'glasswool', 'xps', 'eps', 'pu'],
          facetOrder: 1,
        },
        {
          code: 'thickness_mm',
          dataType: AttributeDataType.NUMBER,
          nameEn: 'Thickness',
          nameFa: 'ضخامت',
          unit: 'mm',
          required: true,
          facetOrder: 2,
        },
      ],
    },
    {
      slug: 'waterproofing',
      cat: extraBySlug.get('waterproofing')!,
      uom: 'm2',
      attrs: [
        {
          code: 'type',
          dataType: AttributeDataType.ENUM,
          nameEn: 'Type',
          nameFa: 'نوع',
          required: true,
          enumOptions: ['membrane', 'coating', 'cementitious'],
          facetOrder: 1,
        },
        {
          code: 'thickness_mm',
          dataType: AttributeDataType.NUMBER,
          nameEn: 'Thickness',
          nameFa: 'ضخامت',
          unit: 'mm',
          required: false,
          facetOrder: 2,
        },
      ],
    },
    {
      slug: 'cement-concrete',
      cat: cement,
      uom: 'ton',
      attrs: [
        {
          code: 'grade',
          dataType: AttributeDataType.STRING,
          nameEn: 'Grade',
          nameFa: 'عیار',
          required: true,
          facetOrder: 1,
        },
        {
          code: 'type',
          dataType: AttributeDataType.ENUM,
          nameEn: 'Type',
          nameFa: 'نوع',
          required: true,
          enumOptions: ['portland', 'white', 'ready-mix', 'mortar'],
          facetOrder: 2,
        },
      ],
    },
    {
      slug: 'steel-rebar',
      cat: steel,
      uom: 'ton',
      attrs: [
        {
          code: 'diameter_mm',
          dataType: AttributeDataType.NUMBER,
          nameEn: 'Diameter',
          nameFa: 'قطر',
          unit: 'mm',
          required: true,
          facetOrder: 1,
        },
        {
          code: 'grade',
          dataType: AttributeDataType.STRING,
          nameEn: 'Grade',
          nameFa: 'گرید',
          required: true,
          facetOrder: 2,
        },
      ],
    },
    {
      slug: 'brick-block',
      cat: extraBySlug.get('brick-block')!,
      uom: 'pcs',
      attrs: [
        {
          code: 'type',
          dataType: AttributeDataType.ENUM,
          nameEn: 'Type',
          nameFa: 'نوع',
          required: true,
          enumOptions: ['clay-brick', 'concrete-block', 'aac', 'facing-brick'],
          facetOrder: 1,
        },
        {
          code: 'size_cm',
          dataType: AttributeDataType.STRING,
          nameEn: 'Size',
          nameFa: 'سایز',
          required: true,
          facetOrder: 2,
        },
      ],
    },
    {
      slug: 'doors',
      cat: doors,
      uom: 'pcs',
      attrs: [
        {
          code: 'width_cm',
          dataType: AttributeDataType.NUMBER,
          nameEn: 'Width',
          nameFa: 'عرض',
          unit: 'cm',
          required: true,
          facetOrder: 1,
        },
        {
          code: 'height_cm',
          dataType: AttributeDataType.NUMBER,
          nameEn: 'Height',
          nameFa: 'ارتفاع',
          unit: 'cm',
          required: true,
          facetOrder: 2,
        },
        {
          code: 'material',
          dataType: AttributeDataType.STRING,
          nameEn: 'Material',
          nameFa: 'جنس',
          required: true,
          facetOrder: 3,
        },
      ],
    },
    {
      slug: 'windows',
      cat: windows,
      uom: 'pcs',
      attrs: [
        {
          code: 'width_cm',
          dataType: AttributeDataType.NUMBER,
          nameEn: 'Width',
          nameFa: 'عرض',
          unit: 'cm',
          required: true,
          facetOrder: 1,
        },
        {
          code: 'height_cm',
          dataType: AttributeDataType.NUMBER,
          nameEn: 'Height',
          nameFa: 'ارتفاع',
          unit: 'cm',
          required: true,
          facetOrder: 2,
        },
        {
          code: 'glazing',
          dataType: AttributeDataType.ENUM,
          nameEn: 'Glazing',
          nameFa: 'شیشه',
          required: true,
          enumOptions: ['single', 'double', 'triple'],
          facetOrder: 3,
        },
      ],
    },
    {
      slug: 'cabinets',
      cat: extraBySlug.get('cabinets')!,
      uom: 'm',
      attrs: [
        {
          code: 'material',
          dataType: AttributeDataType.ENUM,
          nameEn: 'Material',
          nameFa: 'جنس',
          required: true,
          enumOptions: ['mdf', 'hdf', 'plywood', 'solid-wood', 'metal'],
          facetOrder: 1,
        },
        {
          code: 'finish',
          dataType: AttributeDataType.STRING,
          nameEn: 'Finish',
          nameFa: 'روکش',
          required: true,
          facetOrder: 2,
        },
      ],
    },
    {
      slug: 'glass-mirrors',
      cat: extraBySlug.get('glass-mirrors')!,
      uom: 'm2',
      attrs: [
        {
          code: 'type',
          dataType: AttributeDataType.ENUM,
          nameEn: 'Type',
          nameFa: 'نوع',
          required: true,
          enumOptions: ['clear', 'tempered', 'laminated', 'mirror'],
          facetOrder: 1,
        },
        {
          code: 'thickness_mm',
          dataType: AttributeDataType.NUMBER,
          nameEn: 'Thickness',
          nameFa: 'ضخامت',
          unit: 'mm',
          required: true,
          facetOrder: 2,
        },
      ],
    },
    {
      slug: 'sanitaryware',
      cat: extraBySlug.get('sanitaryware')!,
      uom: 'pcs',
      attrs: [
        {
          code: 'type',
          dataType: AttributeDataType.ENUM,
          nameEn: 'Type',
          nameFa: 'نوع',
          required: true,
          enumOptions: ['toilet', 'washbasin', 'bidet', 'urinal', 'set'],
          facetOrder: 1,
        },
        {
          code: 'color',
          dataType: AttributeDataType.STRING,
          nameEn: 'Color',
          nameFa: 'رنگ',
          required: true,
          facetOrder: 2,
        },
      ],
    },
    {
      slug: 'faucets-fixtures',
      cat: extraBySlug.get('faucets-fixtures')!,
      uom: 'pcs',
      attrs: [
        {
          code: 'type',
          dataType: AttributeDataType.ENUM,
          nameEn: 'Type',
          nameFa: 'نوع',
          required: true,
          enumOptions: ['mixer', 'basin', 'shower', 'kitchen', 'valve'],
          facetOrder: 1,
        },
        {
          code: 'finish',
          dataType: AttributeDataType.ENUM,
          nameEn: 'Finish',
          nameFa: 'روکش',
          required: true,
          enumOptions: ['chrome', 'matte-black', 'gold', 'brushed-nickel'],
          facetOrder: 2,
        },
      ],
    },
    {
      slug: 'pipes-fittings',
      cat: extraBySlug.get('pipes-fittings')!,
      uom: 'm',
      attrs: [
        {
          code: 'material',
          dataType: AttributeDataType.ENUM,
          nameEn: 'Material',
          nameFa: 'جنس',
          required: true,
          enumOptions: ['pvc', 'upvc', 'pex', 'copper', 'steel', 'pp'],
          facetOrder: 1,
        },
        {
          code: 'diameter_mm',
          dataType: AttributeDataType.NUMBER,
          nameEn: 'Diameter',
          nameFa: 'قطر',
          unit: 'mm',
          required: true,
          facetOrder: 2,
        },
      ],
    },
    {
      slug: 'electrical-supplies',
      cat: extraBySlug.get('electrical-supplies')!,
      uom: 'pcs',
      attrs: [
        {
          code: 'type',
          dataType: AttributeDataType.STRING,
          nameEn: 'Type',
          nameFa: 'نوع',
          required: true,
          facetOrder: 1,
        },
        {
          code: 'rating',
          dataType: AttributeDataType.STRING,
          nameEn: 'Rating',
          nameFa: 'ظرفیت / آمپر',
          required: true,
          facetOrder: 2,
        },
      ],
    },
    {
      slug: 'lighting',
      cat: extraBySlug.get('lighting')!,
      uom: 'pcs',
      attrs: [
        {
          code: 'type',
          dataType: AttributeDataType.ENUM,
          nameEn: 'Type',
          nameFa: 'نوع',
          required: true,
          enumOptions: ['led-panel', 'downlight', 'chandelier', 'outdoor', 'strip'],
          facetOrder: 1,
        },
        {
          code: 'wattage',
          dataType: AttributeDataType.NUMBER,
          nameEn: 'Wattage',
          nameFa: 'وات',
          unit: 'W',
          required: true,
          facetOrder: 2,
        },
      ],
    },
    {
      slug: 'hvac',
      cat: extraBySlug.get('hvac')!,
      uom: 'pcs',
      attrs: [
        {
          code: 'type',
          dataType: AttributeDataType.ENUM,
          nameEn: 'Type',
          nameFa: 'نوع',
          required: true,
          enumOptions: ['split', 'package', 'fan-coil', 'boiler', 'radiator'],
          facetOrder: 1,
        },
        {
          code: 'capacity',
          dataType: AttributeDataType.STRING,
          nameEn: 'Capacity',
          nameFa: 'ظرفیت',
          required: true,
          facetOrder: 2,
        },
      ],
    },
    {
      slug: 'wood-timber',
      cat: extraBySlug.get('wood-timber')!,
      uom: 'm3',
      attrs: [
        {
          code: 'species',
          dataType: AttributeDataType.STRING,
          nameEn: 'Species / type',
          nameFa: 'نوع چوب',
          required: true,
          facetOrder: 1,
        },
        {
          code: 'thickness_mm',
          dataType: AttributeDataType.NUMBER,
          nameEn: 'Thickness',
          nameFa: 'ضخامت',
          unit: 'mm',
          required: true,
          facetOrder: 2,
        },
      ],
    },
    {
      slug: 'metalwork',
      cat: extraBySlug.get('metalwork')!,
      uom: 'kg',
      attrs: [
        {
          code: 'material',
          dataType: AttributeDataType.ENUM,
          nameEn: 'Material',
          nameFa: 'جنس',
          required: true,
          enumOptions: ['steel', 'aluminum', 'stainless', 'iron'],
          facetOrder: 1,
        },
        {
          code: 'thickness_mm',
          dataType: AttributeDataType.NUMBER,
          nameEn: 'Thickness',
          nameFa: 'ضخامت',
          unit: 'mm',
          required: false,
          facetOrder: 2,
        },
      ],
    },
    {
      slug: 'scaffolding',
      cat: extraBySlug.get('scaffolding')!,
      uom: 'set',
      attrs: [
        {
          code: 'type',
          dataType: AttributeDataType.ENUM,
          nameEn: 'Type',
          nameFa: 'نوع',
          required: true,
          enumOptions: ['frame', 'tube-clamp', 'mobile'],
          facetOrder: 1,
        },
        {
          code: 'height_m',
          dataType: AttributeDataType.NUMBER,
          nameEn: 'Working height',
          nameFa: 'ارتفاع کار',
          unit: 'm',
          required: false,
          facetOrder: 2,
        },
      ],
    },
    {
      slug: 'elevators',
      cat: extraBySlug.get('elevators')!,
      uom: 'pcs',
      attrs: [
        {
          code: 'capacity_kg',
          dataType: AttributeDataType.NUMBER,
          nameEn: 'Capacity',
          nameFa: 'ظرفیت',
          unit: 'kg',
          required: true,
          facetOrder: 1,
        },
        {
          code: 'floors',
          dataType: AttributeDataType.NUMBER,
          nameEn: 'Floors served',
          nameFa: 'تعداد طبقات',
          required: true,
          facetOrder: 2,
        },
      ],
    },
    {
      slug: 'security-systems',
      cat: extraBySlug.get('security-systems')!,
      uom: 'set',
      attrs: [
        {
          code: 'type',
          dataType: AttributeDataType.ENUM,
          nameEn: 'Type',
          nameFa: 'نوع',
          required: true,
          enumOptions: ['cctv', 'alarm', 'access-control', 'intercom'],
          facetOrder: 1,
        },
        {
          code: 'channels',
          dataType: AttributeDataType.NUMBER,
          nameEn: 'Channels / points',
          nameFa: 'تعداد کانال',
          required: false,
          facetOrder: 2,
        },
      ],
    },
    {
      slug: 'landscape-garden',
      cat: extraBySlug.get('landscape-garden')!,
      uom: 'm2',
      attrs: [
        {
          code: 'type',
          dataType: AttributeDataType.ENUM,
          nameEn: 'Type',
          nameFa: 'نوع',
          required: true,
          enumOptions: ['turf', 'paver', 'gravel', 'planting', 'irrigation'],
          facetOrder: 1,
        },
      ],
    },
    {
      slug: 'adhesives-sealants',
      cat: extraBySlug.get('adhesives-sealants')!,
      uom: 'kg',
      attrs: [
        {
          code: 'type',
          dataType: AttributeDataType.ENUM,
          nameEn: 'Type',
          nameFa: 'نوع',
          required: true,
          enumOptions: ['tile-adhesive', 'silicone', 'pu', 'epoxy', 'acrylic'],
          facetOrder: 1,
        },
        {
          code: 'color',
          dataType: AttributeDataType.STRING,
          nameEn: 'Color',
          nameFa: 'رنگ',
          required: false,
          facetOrder: 2,
        },
      ],
    },
    {
      slug: 'tools-hardware',
      cat: extraBySlug.get('tools-hardware')!,
      uom: 'pcs',
      attrs: [
        {
          code: 'type',
          dataType: AttributeDataType.STRING,
          nameEn: 'Type',
          nameFa: 'نوع',
          required: true,
          facetOrder: 1,
        },
        {
          code: 'size',
          dataType: AttributeDataType.STRING,
          nameEn: 'Size',
          nameFa: 'سایز',
          required: false,
          facetOrder: 2,
        },
      ],
    },
  ];

  for (const spec of leafSpecs) {
    await prisma.category.update({
      where: { id: spec.cat.id },
      data: { defaultUomCode: spec.uom },
    });
    for (const attr of spec.attrs) {
      await upsertAttr(spec.cat.id, attr);
    }
  }

  // Deactivate junk root if present
  await prisma.category.updateMany({
    where: { slug: 'p3b-root' },
    data: { isActive: false },
  });

  console.log(
    `Catalog taxonomy ready: ${leafSpecs.length} leaf categories with default UoM + attributes`,
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
  await prisma.pricingSettings.upsert({
    where: { key: 'default' },
    create: {
      key: 'default',
      marginPercent: 5,
      flatFee: 0,
    },
    update: {
      marginPercent: 5,
    },
  });

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
  await seedAutoSeo();
}

/** Deterministic SEO for seed listings/pros — same templates as runtime hooks. */
async function seedAutoSeo() {
  const listings = await prisma.listing.findMany({
    include: {
      category: { select: { nameEn: true, nameFa: true, nameAr: true } },
      facility: { include: { address: { select: { city: true } } } },
    },
  });
  for (const listing of listings) {
    const city = listing.facility?.address?.city || null;
    for (const locale of SEO_LOCALES) {
      const categoryName =
        locale === 'fa'
          ? listing.category.nameFa || listing.category.nameEn
          : locale === 'ar'
            ? listing.category.nameAr || listing.category.nameEn
            : listing.category.nameEn;
      const generated = autoGenerateListingSeo({
        title: listing.title,
        description: listing.description,
        categoryName,
        city,
        locale,
        brand: locale === 'fa' ? 'پی‌تا‌کلید' : locale === 'ar' ? 'بي تا كليد' : 'Peytakilid',
      });
      for (const [field, value] of [
        ['seoTitle', generated.seoTitle],
        ['seoDescription', generated.seoDescription],
      ] as const) {
        await prisma.localizedContent.upsert({
          where: {
            entityType_entityId_localeCode_field: {
              entityType: 'LISTING',
              entityId: listing.id,
              localeCode: locale,
              field,
            },
          },
          create: {
            entityType: 'LISTING',
            entityId: listing.id,
            localeCode: locale,
            field,
            value,
          },
          update: { value },
        });
      }
    }
  }

  const pros = await prisma.organization.findMany({
    where: { isProfessional: true },
    include: {
      facilities: {
        where: { isPublicLocation: true },
        take: 1,
        include: { address: { select: { city: true, province: true } } },
      },
    },
  });
  for (const org of pros) {
    const city = org.facilities[0]?.address?.city || null;
    const province = org.facilities[0]?.address?.province || null;
    const fa = autoGenerateProfessionalSeo({
      name: org.name,
      specialtyLabel: org.primarySpecialty,
      city,
      province,
      locale: 'fa',
      brand: 'پی‌تا‌کلید',
    });
    await prisma.organization.update({
      where: { id: org.id },
      data: { seoTitle: fa.seoTitle, seoDescription: fa.seoDescription },
    });
  }
  console.log(`Auto SEO seeded for ${listings.length} listings + ${pros.length} professionals`);
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
