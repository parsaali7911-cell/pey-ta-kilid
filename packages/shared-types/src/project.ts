/** Construction project stage catalog + requirement helpers (deterministic, not AI). */

export type ProjectStageDef = {
  code: string;
  sortOrder: number;
  nameEn: string;
  nameFa: string;
  /** Leaf category slug hints for product requirements. */
  categorySlugHints: string[];
  /** Professional specialty codes for service requirements. */
  specialtyCodes: string[];
};

export const PROJECT_STAGE_CATALOG: ProjectStageDef[] = [
  {
    code: 'planning',
    sortOrder: 10,
    nameEn: 'Planning / Design',
    nameFa: 'برنامه‌ریزی / طراحی',
    categorySlugHints: [],
    specialtyCodes: ['architecture', 'interior_design'],
  },
  {
    code: 'site_prep',
    sortOrder: 20,
    nameEn: 'Site preparation',
    nameFa: 'آماده‌سازی زمین',
    categorySlugHints: ['scaffolding', 'tools-hardware'],
    specialtyCodes: ['excavation', 'general_contractor'],
  },
  {
    code: 'foundation',
    sortOrder: 30,
    nameEn: 'Foundation',
    nameFa: 'فونداسیون',
    categorySlugHints: ['cement-concrete', 'steel-rebar', 'waterproofing'],
    specialtyCodes: ['concrete', 'general_contractor'],
  },
  {
    code: 'structure',
    sortOrder: 40,
    nameEn: 'Structure',
    nameFa: 'اسکلت',
    categorySlugHints: ['steel-rebar', 'cement-concrete', 'brick-block'],
    specialtyCodes: ['steel_structure', 'concrete', 'general_contractor'],
  },
  {
    code: 'walls',
    sortOrder: 50,
    nameEn: 'Walls',
    nameFa: 'دیوارچینی',
    categorySlugHints: ['brick-block', 'gypsum-plaster', 'insulation'],
    specialtyCodes: ['masonry', 'general_contractor'],
  },
  {
    code: 'roofing',
    sortOrder: 60,
    nameEn: 'Roofing',
    nameFa: 'سقف',
    categorySlugHints: ['waterproofing', 'insulation', 'metalwork'],
    specialtyCodes: ['roofing', 'general_contractor'],
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
    specialtyCodes: ['electrical', 'plumbing', 'hvac'],
  },
  {
    code: 'facade',
    sortOrder: 80,
    nameEn: 'Facade',
    nameFa: 'نما',
    categorySlugHints: ['natural-stone', 'paint-coatings', 'glass-mirrors'],
    specialtyCodes: ['facade', 'stone_installation'],
  },
  {
    code: 'doors_windows',
    sortOrder: 90,
    nameEn: 'Doors / Windows',
    nameFa: 'در و پنجره',
    categorySlugHints: ['doors', 'windows', 'glass-mirrors'],
    specialtyCodes: ['carpentry', 'aluminum'],
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
    ],
    specialtyCodes: ['tile_installation', 'stone_installation', 'flooring'],
  },
  {
    code: 'cabinetry',
    sortOrder: 110,
    nameEn: 'Cabinetry / Woodwork',
    nameFa: 'کابینت / نجاری',
    categorySlugHints: ['cabinets', 'wood-timber'],
    specialtyCodes: ['cabinetry', 'carpentry'],
  },
  {
    code: 'finishing',
    sortOrder: 120,
    nameEn: 'Finishing / Paint',
    nameFa: 'نازک‌کاری / رنگ',
    categorySlugHints: ['paint-coatings', 'gypsum-plaster', 'wall-tile'],
    specialtyCodes: ['painting', 'plastering', 'tile_installation'],
  },
  {
    code: 'final',
    sortOrder: 130,
    nameEn: 'Final installation / Handover',
    nameFa: 'نصب نهایی / تحویل',
    categorySlugHints: ['lighting', 'security-systems', 'landscape-garden'],
    specialtyCodes: ['general_contractor', 'electrical', 'plumbing'],
  },
];

export function projectStageByCode(code: string): ProjectStageDef | undefined {
  return PROJECT_STAGE_CATALOG.find((s) => s.code === code);
}

export function projectStageLabel(code: string, locale = 'fa'): string {
  const s = projectStageByCode(code);
  if (!s) return code;
  return locale === 'en' ? s.nameEn : s.nameFa;
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
