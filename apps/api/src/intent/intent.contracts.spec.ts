import {
  BUILDING_CATEGORIES,
  BUILDING_SPECIALTIES,
  IRAN_CITIES,
  IRAN_PROVINCES,
  MAX_CLARIFICATION_FIELDS,
  RequestIntent,
} from '@peytakilid/shared-types';
import {
  buildClarificationPrompt,
  parseNaturalLanguageRules,
} from './intent-rule.parser';
import { IntentService } from './intent.service';
import {
  CATEGORY_LEXICON_BUILT,
  IRAN_CITY_MATCHERS,
  SPECIALTY_LEXICON_BUILT,
} from './lexicon/build-lexicon';

describe('Iran + building lexicon coverage', () => {
  it('loads all 31 provinces and a nationwide city set', () => {
    expect(IRAN_PROVINCES).toHaveLength(31);
    expect(IRAN_CITIES.length).toBeGreaterThanOrEqual(300);
    expect(IRAN_CITY_MATCHERS.length).toBe(IRAN_CITIES.length);
  });

  it('loads comprehensive building categories and specialties', () => {
    expect(BUILDING_CATEGORIES.length).toBeGreaterThanOrEqual(28);
    expect(BUILDING_SPECIALTIES.length).toBeGreaterThanOrEqual(50);
    expect(Object.keys(CATEGORY_LEXICON_BUILT.slugByHint).length).toBe(
      BUILDING_CATEGORIES.length,
    );
    expect(SPECIALTY_LEXICON_BUILT.specialtyOptions.length).toBe(BUILDING_SPECIALTIES.length);
  });

  it('resolves random Iranian cities and trades from NL prompts', () => {
    const service = new IntentService();
    const samples = [
      { text: 'دنبال جوشکار هستم تو بروجرد', next: 'professional_search', city: 'Borujerd', specialty: 'welding' },
      { text: 'ایزوگام برای بندرعباس میخوام', next: 'search', city: 'Bandar Abbas', slug: 'waterproofing' },
      { text: 'من کابینت‌ساز هستم در سنندج', next: 'professional_onboard', city: 'Sanandaj', specialty: 'cabinet_making' },
      { text: 'شیرآلات ساختمانی برای یاسوج', next: 'search', city: 'Yasuj', slug: 'faucets-fixtures' },
      { text: 'دنبال کناف‌کار در استان مازندران', next: 'professional_search', specialty: 'drywall' },
    ] as const;

    for (const sample of samples) {
      const res = service.parseHomepageRequest({ text: sample.text, locale: 'fa', market: 'IRAN' });
      expect(res.next).toBe(sample.next);
      if ('city' in sample && sample.city) expect(res.route?.city).toBe(sample.city);
      if ('specialty' in sample && sample.specialty) expect(res.route?.specialty).toBe(sample.specialty);
      if ('slug' in sample && sample.slug) expect(res.route?.categorySlug).toBe(sample.slug);
    }
  });
});

describe('intent rule parser (Phase 0-F)', () => {
  it('routes PRODUCT and extracts qty/UoM, category, budget, location', () => {
    const req = parseNaturalLanguageRules({
      text: 'Need 120 m2 marble tile color beige finish polished budget 5000-8000 USD in Tehran listing:lst_marble01',
      locale: 'en',
      market: 'IRAN',
    });
    expect(req.intent).toBe(RequestIntent.PRODUCT);
    expect(req.quantity).toBe(120);
    expect(req.uomCode).toBe('m2');
    expect(req.categoryHints).toEqual(expect.arrayContaining(['tile', 'stone']));
    expect(req.attributeFilters.color).toBe('beige');
    expect(req.attributeFilters.finish).toBe('polished');
    expect(req.budget?.currency).toBe('USD');
    expect(req.budget?.min).toBe(5000);
    expect(req.budget?.max).toBe(8000);
    expect(req.location?.city).toBe('Tehran');
    expect(req.listingIdHints).toContain('lst_marble01');
    expect(req.confidence).toBeGreaterThan(0.5);
  });

  it('routes PROFESSIONAL with specialty and city', () => {
    const req = parseNaturalLanguageRules({
      text: 'Looking for a stone installer contractor in Isfahan',
      locale: 'en',
    });
    expect(req.intent).toBe(RequestIntent.PROFESSIONAL);
    expect(req.specialtyHints.length).toBeGreaterThan(0);
    expect(req.location?.city).toBe('Isfahan');
  });

  it('routes DESIGN_ASSIST from design cues / image asset', () => {
    const byText = parseNaturalLanguageRules({
      text: 'Please design help match color from this moodboard for tile',
    });
    expect(byText.intent).toBe(RequestIntent.DESIGN_ASSIST);

    const byImage = parseNaturalLanguageRules({
      text: 'find similar materials',
      imageAssetId: 'asset_123',
    });
    expect(byImage.intent).toBe(RequestIntent.DESIGN_ASSIST);
  });

  it('routes AMBIGUOUS when product and professional cues collide without a clear seeker role', () => {
    const req = parseNaturalLanguageRules({
      text: 'قیمت کاشی و نصب برای پروژه',
      locale: 'fa',
    });
    expect(req.intent).toBe(RequestIntent.AMBIGUOUS);
    expect(req.missingFields).toContain('intent');
  });

  it('prefers find-professional when seeker asks for tile plus installer', () => {
    const service = new IntentService();
    const res = service.parseHomepageRequest({
      text: 'looking for tile and an installer in Tehran',
      locale: 'en',
    });
    expect(res.next).toBe('professional_search');
    expect(res.route?.city).toBe('Tehran');
  });

  it('limits clarification to 1–3 blocking fields', () => {
    const req = parseNaturalLanguageRules({ text: 'hello' });
    const prompt = buildClarificationPrompt(req);
    expect(prompt).not.toBeNull();
    expect(prompt!.fields.length).toBeGreaterThanOrEqual(1);
    expect(prompt!.fields.length).toBeLessThanOrEqual(MAX_CLARIFICATION_FIELDS);
    expect(prompt!.fields.every((f) => f.reason === 'blocking')).toBe(true);
  });

  it('routes seller onboard from Persian seller prompt', () => {
    const service = new IntentService();
    const res = service.parseHomepageRequest({
      text: 'من فروشنده سرامیک هستم در تهران',
      locale: 'fa',
      market: 'IRAN',
    });
    expect(res.next).toBe('seller_onboard');
    expect(res.route?.categorySlug).toBe('ceramic-tile');
    expect(res.route?.city).toBe('Tehran');
  });

  it('routes professional onboard from trade self-intro', () => {
    const service = new IntentService();
    const res = service.parseHomepageRequest({
      text: 'من گچ کار هستم توی زنجان',
      locale: 'fa',
    });
    expect(res.next).toBe('professional_onboard');
    expect(res.route?.specialty).toBe('plastering');
    expect(res.route?.city).toBe('Zanjan');
  });

  it('routes professional search when seeking a trade in a city', () => {
    const service = new IntentService();
    const res = service.parseHomepageRequest({
      text: 'من دنبال سرامیک کار هستم توی رشت',
      locale: 'fa',
    });
    expect(res.next).toBe('professional_search');
    expect(res.route?.specialty).toBe('tile_installation');
    expect(res.route?.city).toBe('Rasht');
  });

  it('routes buyer tile qty/size/city to product search', () => {
    const service = new IntentService();
    const res = service.parseHomepageRequest({
      text: 'من ۸۰ متر کاشی ۳۰*۳۰ برای کاشان میخوام',
      locale: 'fa',
      market: 'IRAN',
    });
    expect(res.next).toBe('search');
    expect(res.intent.requirements.quantity).toBe(80);
    expect(res.intent.requirements.uomCode).toBe('m2');
    expect(res.intent.requirements.attributeFilters.size_cm).toBe('30x30');
    expect(res.route?.categorySlug).toBe('ceramic-tile');
    expect(res.route?.city).toBe('Kashan');
    expect(res.searchQuery?.filters?.text).toMatch(/30x30|Kashan/);
  });

  it('routes UPVC window request to search without blocking on quantity', () => {
    const service = new IntentService();
    const res = service.parseHomepageRequest({
      text: 'درخواست پنجره یو پی وی سی دارم',
      locale: 'fa',
    });
    expect(res.next).toBe('search');
    expect(res.route?.categorySlug).toBe('windows');
    expect(res.intent.requirements.attributeFilters.material).toBe('upvc');
  });

  it('routes flooring buy with city (photo caption companion)', () => {
    const service = new IntentService();
    const res = service.parseHomepageRequest({
      text: 'برای کرج این کفپوش رو میخوام',
      locale: 'fa',
      imageAssetId: 'asset_floor_1',
    });
    expect(res.next).toBe('search');
    expect(res.route?.categorySlug).toBe('laminate-flooring');
    expect(res.route?.city).toBe('Karaj');
  });

  it('routes oil painter seeker in Qeshm area', () => {
    const service = new IntentService();
    const res = service.parseHomepageRequest({
      text: 'دنبال نقاش هستم رنگ روغن تو محدوده ی قشم',
      locale: 'fa',
    });
    expect(res.next).toBe('professional_search');
    expect(res.route?.specialty).toBe('painting');
    expect(res.route?.city).toBe('Qeshm');
    expect(res.intent.requirements.attributeFilters.paint_type).toBe('oil');
    expect(res.intent.requirements.attributeFilters.color).toBeUndefined();
  });

  it('does not invent inventory/cost and keeps draft contracts', () => {
    const service = new IntentService();
    const product = service.parseHomepageRequest({
      text: 'Need 50 m2 ceramic tile in Tehran',
      locale: 'en',
      market: 'IRAN',
    });
    expect(JSON.stringify(product)).not.toMatch(/supplierCost|onHand|invent/i);

    const pro = service.parseHomepageRequest({
      text: 'Need an architect in Dubai',
    });
    expect(pro.next).toBe('professional_search');
    expect(pro.professionalLead?.status).toBe('draft_contract');
    expect(pro.route?.specialty).toBe('architecture');
    expect(pro.route?.city).toBe('Dubai');

    const clarify = service.parseHomepageRequest({ text: 'help' });
    expect(clarify.next).toBe('clarify');
    expect((clarify.intent.clarification?.fields.length ?? 0)).toBeLessThanOrEqual(3);
  });
});
