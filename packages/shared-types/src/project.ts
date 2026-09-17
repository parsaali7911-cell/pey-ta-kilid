/** Construction project stage catalog + procurement suggestion helpers. */

export type ProjectStageDef = {
  code: string;
  sortOrder: number;
  nameEn: string;
  nameFa: string;
  /** Leaf category slug hints for product requirements. */
  categorySlugHints: string[];
  /** Professional specialty codes (must match BUILDING_SPECIALTIES). */
  specialtyCodes: string[];
  /** Optional m² multipliers for rough quantity estimates (planned, not verified). */
  qtyFactors?: Record<string, number>;
};

export const PROJECT_STAGE_CATALOG: ProjectStageDef[] = [
  {
    code: 'planning',
    sortOrder: 10,
    nameEn: 'Planning / Design',
    nameFa: 'برنامه‌ریزی / طراحی',
    categorySlugHints: [],
    specialtyCodes: ['architecture', 'interior_design', 'quantity_survey', 'civil_engineering'],
  },
  {
    code: 'site_prep',
    sortOrder: 20,
    nameEn: 'Site preparation',
    nameFa: 'آماده‌سازی زمین',
    categorySlugHints: ['scaffolding', 'tools-hardware'],
    specialtyCodes: ['excavation', 'demolition', 'scaffolding', 'contracting'],
  },
  {
    code: 'foundation',
    sortOrder: 30,
    nameEn: 'Foundation',
    nameFa: 'فونداسیون',
    categorySlugHints: ['cement-concrete', 'steel-rebar', 'waterproofing'],
    specialtyCodes: ['concrete_work', 'rebar_tying', 'formwork', 'waterproofing', 'contracting'],
    qtyFactors: { 'cement-concrete': 0.35, 'steel-rebar': 0.08 },
  },
  {
    code: 'structure',
    sortOrder: 40,
    nameEn: 'Structure',
    nameFa: 'اسکلت',
    categorySlugHints: ['steel-rebar', 'cement-concrete', 'brick-block', 'metalwork'],
    specialtyCodes: ['concrete_work', 'rebar_tying', 'welding', 'metalwork', 'formwork'],
    qtyFactors: { 'steel-rebar': 0.12, 'cement-concrete': 0.25, 'brick-block': 8 },
  },
  {
    code: 'walls',
    sortOrder: 50,
    nameEn: 'Walls',
    nameFa: 'دیوارچینی',
    categorySlugHints: ['brick-block', 'gypsum-plaster', 'insulation', 'adhesives-sealants'],
    specialtyCodes: ['masonry', 'plastering', 'insulation_tech', 'drywall'],
    qtyFactors: { 'brick-block': 12, 'gypsum-plaster': 4, insulation: 1.1 },
  },
  {
    code: 'roofing',
    sortOrder: 60,
    nameEn: 'Roofing',
    nameFa: 'سقف',
    categorySlugHints: ['waterproofing', 'insulation', 'metalwork', 'false-ceiling'],
    specialtyCodes: ['roofing', 'waterproofing', 'false_ceiling', 'insulation_tech'],
    qtyFactors: { waterproofing: 1.05, insulation: 1.0 },
  },
  {
    code: 'mep',
    sortOrder: 70,
    nameEn: 'MEP',
    nameFa: 'تأسیسات',
    categorySlugHints: [
      'electrical-supplies',
      'pipes-fittings',
      'faucets-fixtures',
      'sanitaryware',
      'hvac',
      'lighting',
    ],
    specialtyCodes: ['electrical', 'plumbing', 'hvac_tech', 'gas_fitting', 'sewage'],
    qtyFactors: {
      'electrical-supplies': 0.8,
      'pipes-fittings': 1.2,
      lighting: 0.15,
    },
  },
  {
    code: 'facade',
    sortOrder: 80,
    nameEn: 'Facade',
    nameFa: 'نما',
    categorySlugHints: ['natural-stone', 'paint-coatings', 'glass-mirrors', 'metalwork'],
    specialtyCodes: ['facade', 'stone_installation', 'glasswork', 'scaffolding'],
    qtyFactors: { 'natural-stone': 0.55, 'paint-coatings': 0.4, 'glass-mirrors': 0.12 },
  },
  {
    code: 'doors_windows',
    sortOrder: 90,
    nameEn: 'Doors / Windows',
    nameFa: 'در و پنجره',
    categorySlugHints: ['doors', 'windows', 'glass-mirrors'],
    specialtyCodes: ['upvc_install', 'aluminum_work', 'carpentry', 'glasswork'],
    qtyFactors: { doors: 0.02, windows: 0.03 },
  },
  {
    code: 'flooring',
    sortOrder: 100,
    nameEn: 'Flooring',
    nameFa: 'کف‌سازی',
    categorySlugHints: [
      'ceramic-tile',
      'porcelain-tile',
      'natural-stone',
      'laminate-flooring',
      'adhesives-sealants',
    ],
    specialtyCodes: ['tile_installation', 'stone_installation', 'flooring_install'],
    qtyFactors: {
      'ceramic-tile': 0.7,
      'porcelain-tile': 0.25,
      'natural-stone': 0.15,
      'laminate-flooring': 0.2,
    },
  },
  {
    code: 'cabinetry',
    sortOrder: 110,
    nameEn: 'Cabinetry / Woodwork',
    nameFa: 'کابینت / نجاری',
    categorySlugHints: ['cabinets', 'wood-timber'],
    specialtyCodes: ['cabinet_making', 'carpentry', 'kitchen_install'],
    qtyFactors: { cabinets: 0.04, 'wood-timber': 0.08 },
  },
  {
    code: 'finishing',
    sortOrder: 120,
    nameEn: 'Finishing / Paint',
    nameFa: 'نازک‌کاری / رنگ',
    categorySlugHints: ['paint-coatings', 'gypsum-plaster', 'wall-tile', 'wallpaper'],
    specialtyCodes: ['painting', 'plastering', 'tile_installation', 'wallpaper'],
    qtyFactors: { 'paint-coatings': 1.2, 'gypsum-plaster': 2.5, wallpaper: 0.3 },
  },
  {
    code: 'final',
    sortOrder: 130,
    nameEn: 'Final installation / Handover',
    nameFa: 'نصب نهایی / تحویل',
    categorySlugHints: ['lighting', 'security-systems', 'landscape-garden', 'elevators'],
    specialtyCodes: [
      'electrical',
      'plumbing',
      'security_install',
      'landscape',
      'cleaning',
      'inspection',
    ],
    qtyFactors: { lighting: 0.12, 'security-systems': 0.02 },
  },
];

/** Extra categories/specialties by project type (merged into current + upcoming stages). */
export const PROJECT_TYPE_OVERLAYS: Record<
  string,
  { categorySlugHints: string[]; specialtyCodes: string[]; qtyBoost?: number }
> = {
  villa: {
    categorySlugHints: ['natural-stone', 'landscape-garden', 'cabinets'],
    specialtyCodes: ['landscape', 'facade', 'stone_installation', 'pool_construction'],
    qtyBoost: 1.1,
  },
  apartment: {
    categorySlugHints: ['ceramic-tile', 'doors', 'windows', 'elevators'],
    specialtyCodes: ['tile_installation', 'upvc_install', 'elevator_tech'],
    qtyBoost: 1.0,
  },
  office: {
    categorySlugHints: ['false-ceiling', 'lighting', 'security-systems', 'glass-mirrors'],
    specialtyCodes: ['false_ceiling', 'electrical', 'security_install', 'smart_home'],
    qtyBoost: 0.95,
  },
  renovation: {
    categorySlugHints: ['paint-coatings', 'ceramic-tile', 'doors', 'faucets-fixtures'],
    specialtyCodes: ['demolition', 'painting', 'tile_installation', 'plumbing'],
    qtyBoost: 0.7,
  },
  other: {
    categorySlugHints: [],
    specialtyCodes: ['contracting'],
    qtyBoost: 1.0,
  },
};

export function projectStageByCode(code: string): ProjectStageDef | undefined {
  return PROJECT_STAGE_CATALOG.find((s) => s.code === code);
}

export function projectStageLabel(code: string, locale = 'fa'): string {
  const s = projectStageByCode(code);
  if (!s) return code;
  return locale === 'en' ? s.nameEn : s.nameFa;
}

export type SuggestedNeed = {
  kind: 'PRODUCT' | 'SERVICE';
  stageCode: string;
  titleEn: string;
  titleFa: string;
  categorySlug?: string;
  specialtyCode?: string;
  quantity?: number | null;
  uomCode?: string | null;
  reason: string;
  priority: 'now' | 'soon' | 'later';
};

const CATEGORY_META: Record<string, { en: string; fa: string; uom: string }> = {
  'ceramic-tile': { en: 'Ceramic tile', fa: 'سرامیک', uom: 'm2' },
  'porcelain-tile': { en: 'Porcelain tile', fa: 'پرسلان', uom: 'm2' },
  'natural-stone': { en: 'Natural stone', fa: 'سنگ طبیعی', uom: 'm2' },
  'laminate-flooring': { en: 'Laminate flooring', fa: 'لمینت', uom: 'm2' },
  'cement-concrete': { en: 'Cement / concrete', fa: 'سیمان و بتن', uom: 'ton' },
  'steel-rebar': { en: 'Steel / rebar', fa: 'میلگرد و فولاد', uom: 'ton' },
  'brick-block': { en: 'Brick / block', fa: 'آجر و بلوک', uom: 'pcs' },
  'gypsum-plaster': { en: 'Gypsum / plaster', fa: 'گچ و اندود', uom: 'kg' },
  'paint-coatings': { en: 'Paint / coatings', fa: 'رنگ و پوشش', uom: 'l' },
  insulation: { en: 'Insulation', fa: 'عایق', uom: 'm2' },
  waterproofing: { en: 'Waterproofing', fa: 'عایق رطوبتی', uom: 'm2' },
  doors: { en: 'Doors', fa: 'درب', uom: 'pcs' },
  windows: { en: 'Windows', fa: 'پنجره', uom: 'pcs' },
  cabinets: { en: 'Cabinets', fa: 'کابینت', uom: 'm' },
  sanitaryware: { en: 'Sanitaryware', fa: 'چینی بهداشتی', uom: 'pcs' },
  'faucets-fixtures': { en: 'Faucets', fa: 'شیرآلات', uom: 'pcs' },
  'pipes-fittings': { en: 'Pipes & fittings', fa: 'لوله و اتصالات', uom: 'm' },
  'electrical-supplies': { en: 'Electrical supplies', fa: 'لوازم برقی', uom: 'pcs' },
  lighting: { en: 'Lighting', fa: 'روشنایی', uom: 'pcs' },
  hvac: { en: 'HVAC', fa: 'تهویه / پکیج', uom: 'pcs' },
  'glass-mirrors': { en: 'Glass & mirrors', fa: 'شیشه و آینه', uom: 'm2' },
  'wood-timber': { en: 'Wood / MDF', fa: 'چوب و MDF', uom: 'm3' },
  metalwork: { en: 'Metalwork', fa: 'آهن‌آلات', uom: 'kg' },
  scaffolding: { en: 'Scaffolding', fa: 'داربست', uom: 'set' },
  elevators: { en: 'Elevators', fa: 'آسانسور', uom: 'pcs' },
  'security-systems': { en: 'Security systems', fa: 'سیستم امنیتی', uom: 'set' },
  'landscape-garden': { en: 'Landscape', fa: 'محوطه‌سازی', uom: 'm2' },
  'adhesives-sealants': { en: 'Adhesives', fa: 'چسب و درزگیر', uom: 'kg' },
  'false-ceiling': { en: 'False ceiling', fa: 'سقف کاذب', uom: 'm2' },
  wallpaper: { en: 'Wallpaper', fa: 'کاغذ دیواری', uom: 'm2' },
  'tools-hardware': { en: 'Tools / hardware', fa: 'ابزار و یراق', uom: 'pcs' },
  'wall-tile': { en: 'Wall tile', fa: 'کاشی دیوار', uom: 'm2' },
};

const SPECIALTY_META: Record<string, { en: string; fa: string }> = {
  architecture: { en: 'Architect', fa: 'معمار' },
  interior_design: { en: 'Interior designer', fa: 'طراح داخلی' },
  contracting: { en: 'General contractor', fa: 'پیمانکار' },
  excavation: { en: 'Excavation', fa: 'خاکبرداری' },
  demolition: { en: 'Demolition', fa: 'تخریب' },
  scaffolding: { en: 'Scaffolder', fa: 'داربست‌بند' },
  concrete_work: { en: 'Concrete work', fa: 'بتن‌ریزی' },
  rebar_tying: { en: 'Rebar work', fa: 'آرماتوربندی' },
  formwork: { en: 'Formwork', fa: 'قالب‌بندی' },
  waterproofing: { en: 'Waterproofing', fa: 'عایق‌کاری' },
  welding: { en: 'Welding', fa: 'جوشکاری' },
  metalwork: { en: 'Metalwork', fa: 'فلزکاری' },
  masonry: { en: 'Masonry', fa: 'بنایی / دیوارچینی' },
  plastering: { en: 'Plastering', fa: 'گچ‌کاری' },
  insulation_tech: { en: 'Insulation', fa: 'عایق حرارتی' },
  drywall: { en: 'Drywall / Knauf', fa: 'کناف' },
  roofing: { en: 'Roofing', fa: 'سقف‌کاری' },
  false_ceiling: { en: 'False ceiling', fa: 'سقف کاذب' },
  electrical: { en: 'Electrician', fa: 'برقکار' },
  plumbing: { en: 'Plumber', fa: 'لوله‌کش' },
  hvac_tech: { en: 'HVAC technician', fa: 'تکنسین تهویه' },
  gas_fitting: { en: 'Gas fitter', fa: 'گازکش' },
  sewage: { en: 'Sewage', fa: 'فاضلاب' },
  facade: { en: 'Facade specialist', fa: 'نماکار' },
  stone_installation: { en: 'Stone installer', fa: 'سنگ‌کار' },
  glasswork: { en: 'Glazier', fa: 'شیشه‌بر' },
  upvc_install: { en: 'UPVC installer', fa: 'نصاب UPVC' },
  aluminum_work: { en: 'Aluminum fabricator', fa: 'آلومینیوم‌کار' },
  carpentry: { en: 'Carpenter', fa: 'نجار' },
  tile_installation: { en: 'Tile installer', fa: 'سرامیک‌کار' },
  flooring_install: { en: 'Flooring installer', fa: 'کفپوش‌کار' },
  cabinet_making: { en: 'Cabinet maker', fa: 'کابینت‌ساز' },
  kitchen_install: { en: 'Kitchen installer', fa: 'نصاب آشپزخانه' },
  painting: { en: 'Painter', fa: 'نقاش' },
  wallpaper: { en: 'Wallpaper installer', fa: 'کاغذدیواری' },
  security_install: { en: 'Security installer', fa: 'نصاب دوربین' },
  landscape: { en: 'Landscaper', fa: 'محوطه‌ساز' },
  cleaning: { en: 'Cleaning', fa: 'نظافت ساختمان' },
  inspection: { en: 'Inspector', fa: 'ناظر' },
  elevator_tech: { en: 'Elevator technician', fa: 'سرویس آسانسور' },
  smart_home: { en: 'Smart home', fa: 'خانه هوشمند' },
  pool_construction: { en: 'Pool builder', fa: 'استخرساز' },
  quantity_survey: { en: 'Quantity surveyor', fa: 'مترور' },
  civil_engineering: { en: 'Civil engineer', fa: 'مهندس عمران' },
};

/**
 * Long-lead categories that should be procured one stage early
 * (elevated to "soon" while current stage is still active).
 */
const ADVANCE_BUY_SLUGS = new Set([
  'steel-rebar',
  'elevators',
  'windows',
  'doors',
  'cabinets',
  'hvac',
  'natural-stone',
  'security-systems',
]);

const PRIORITY_ORDER: Record<SuggestedNeed['priority'], number> = {
  now: 0,
  soon: 1,
  later: 2,
};

export function buildStageSuggestions(input: {
  currentStageCode?: string | null;
  projectTypeCode?: string | null;
  areaM2?: number | null;
  includeUpcoming?: number;
}): SuggestedNeed[] {
  const includeUpcoming = input.includeUpcoming ?? 2;
  const current =
    projectStageByCode(input.currentStageCode || '') || PROJECT_STAGE_CATALOG[0];
  const idx = PROJECT_STAGE_CATALOG.findIndex((s) => s.code === current.code);
  const stages = PROJECT_STAGE_CATALOG.slice(idx, idx + 1 + includeUpcoming);
  const overlay =
    PROJECT_TYPE_OVERLAYS[input.projectTypeCode || 'other'] || PROJECT_TYPE_OVERLAYS.other;
  const boost = overlay.qtyBoost ?? 1;
  const area = input.areaM2 != null && input.areaM2 > 0 ? Number(input.areaM2) : null;
  const out: SuggestedNeed[] = [];
  const seen = new Set<string>();

  const pushProduct = (
    stage: ProjectStageDef,
    slug: string,
    priority: SuggestedNeed['priority'],
    reasonExtra: string,
  ) => {
    const key = `P:${stage.code}:${slug}`;
    if (seen.has(key)) return;
    seen.add(key);
    const meta = CATEGORY_META[slug] || { en: slug, fa: slug, uom: 'pcs' };
    const factor = stage.qtyFactors?.[slug];
    // Current stage gets full qty; upcoming gets conservative estimate.
    const stageQtyScale = priority === 'now' ? 1 : priority === 'soon' ? 0.85 : 0.6;
    const quantity =
      area != null && factor != null
        ? Math.max(1, Math.round(area * factor * boost * stageQtyScale))
        : null;
    out.push({
      kind: 'PRODUCT',
      stageCode: stage.code,
      titleEn: meta.en,
      titleFa: meta.fa,
      categorySlug: slug,
      quantity,
      uomCode: meta.uom,
      reason: `stage:${stage.code};type:${input.projectTypeCode || 'other'};priority:${priority};${reasonExtra}`,
      priority,
    });
  };

  const pushService = (
    stage: ProjectStageDef,
    code: string,
    priority: SuggestedNeed['priority'],
    reasonExtra: string,
  ) => {
    const key = `S:${stage.code}:${code}`;
    if (seen.has(key)) return;
    seen.add(key);
    const meta = SPECIALTY_META[code] || { en: code, fa: code };
    out.push({
      kind: 'SERVICE',
      stageCode: stage.code,
      titleEn: meta.en,
      titleFa: meta.fa,
      specialtyCode: code,
      quantity: null,
      uomCode: null,
      reason: `stage:${stage.code};type:${input.projectTypeCode || 'other'};priority:${priority};${reasonExtra}`,
      priority,
    });
  };

  stages.forEach((stage, offset) => {
    const basePriority: SuggestedNeed['priority'] =
      offset === 0 ? 'now' : offset === 1 ? 'soon' : 'later';

    // Current stage: full catalog + type overlay (stage-first, dense).
    // Upcoming: trim to top hints so "now" stays dominant.
    const catLimit = offset === 0 ? Infinity : offset === 1 ? 4 : 2;
    const specLimit = offset === 0 ? Infinity : offset === 1 ? 3 : 2;

    const cats = [
      ...stage.categorySlugHints,
      ...(offset === 0 ? overlay.categorySlugHints : []),
    ].slice(0, catLimit === Infinity ? undefined : catLimit);

    for (const slug of cats) {
      pushProduct(stage, slug, basePriority, offset === 0 ? 'current' : 'lookahead');
    }

    const specs = [
      ...stage.specialtyCodes,
      ...(offset === 0 ? overlay.specialtyCodes : []),
    ].slice(0, specLimit === Infinity ? undefined : specLimit);

    for (const code of specs) {
      pushService(stage, code, basePriority, offset === 0 ? 'current' : 'lookahead');
    }
  });

  // Advance-buy: long-lead items from the *next* stage elevated while still on current.
  const nextStage = PROJECT_STAGE_CATALOG[idx + 1];
  if (nextStage) {
    for (const slug of nextStage.categorySlugHints) {
      if (!ADVANCE_BUY_SLUGS.has(slug)) continue;
      pushProduct(nextStage, slug, 'soon', 'advance-buy');
    }
  }

  // Stage-centric sort: now → soon → later, products before services within band.
  out.sort((a, b) => {
    const pd = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (pd !== 0) return pd;
    if (a.kind !== b.kind) return a.kind === 'PRODUCT' ? -1 : 1;
    const sa =
      projectStageByCode(a.stageCode)?.sortOrder ??
      PROJECT_STAGE_CATALOG.findIndex((s) => s.code === a.stageCode);
    const sb =
      projectStageByCode(b.stageCode)?.sortOrder ??
      PROJECT_STAGE_CATALOG.findIndex((s) => s.code === b.stageCode);
    return sa - sb;
  });

  return out;
}

export type ProjectRequirementKind = 'PRODUCT' | 'SERVICE';
export type ProjectRequirementStatus =
  | 'PLANNED'
  | 'SOURCING'
  | 'RFQ_OPEN'
  | 'ORDERED'
  | 'FULFILLED'
  | 'CANCELLED';
export type ProjectRequirementSource = 'MANUAL' | 'STAGE_TEMPLATE' | 'AI_SUGGESTION';
export type ProjectLeadTimeSource = 'NONE' | 'LISTING' | 'QUOTE' | 'MANUAL_ESTIMATE';
export type ProjectStatus = 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'ARCHIVED';
export type ProjectStageStatus = 'PLANNED' | 'ACTIVE' | 'DONE' | 'SKIPPED';
export type ProjectMemberRole = 'OWNER' | 'EDITOR' | 'VIEWER';

/** recommendedRfqDate only when needByDate + verifiedLeadTimeDays both present. */
export function computeRecommendedRfqDate(
  needByDate: Date | string | null | undefined,
  verifiedLeadTimeDays: number | null | undefined,
): Date | null {
  if (needByDate == null || verifiedLeadTimeDays == null || verifiedLeadTimeDays < 0) {
    return null;
  }
  const d = new Date(needByDate);
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCDate(d.getUTCDate() - verifiedLeadTimeDays);
  return d;
}
