export type UiLocale = 'fa' | 'en' | 'ar';

type Copy = {
  brand: string;
  tagline: string;
  navHome: string;
  navCatalog: string;
  navSearch: string;
  needTitle: string;
  needSubtitle: string;
  needPlaceholder: string;
  needSubmit: string;
  needWorking: string;
  examplesLabel: string;
  examples: string[];
  journeyTitle: string;
  journey: Array<{ title: string; body: string }>;
  catalogTitle: string;
  catalogSubtitle: string;
  searchTitle: string;
  searchSubtitle: string;
  noResults: string;
  viewListing: string;
  price: string;
  available: string;
  moq: string;
  leadTime: string;
  seller: string;
  facility: string;
  category: string;
  specs: string;
  askPrice: string;
  days: string;
  clarifying: string;
  intentProduct: string;
  intentProfessional: string;
  intentDesign: string;
  intentAmbiguous: string;
  professionalHint: string;
  designHint: string;
  rfqHint: string;
  errorGeneric: string;
  footer: string;
  marketIran: string;
  marketIntl: string;
};

const COPY: Record<UiLocale, Copy> = {
  fa: {
    brand: 'پیتاکیلید',
    tagline: 'از نیاز پروژه تا تأمین مصالح و خدمات ساختمانی',
    navHome: 'خانه',
    navCatalog: 'کاتالوگ',
    navSearch: 'جستجو',
    needTitle: 'نیاز پروژه‌ات را بگو',
    needSubtitle:
      'نیازت را بنویس تا کالاهای مرتبط نشان داده شود.',
    needPlaceholder:
      'مثلاً: برای لابی هتل سنگ سفید با رگه طوسی می‌خوام، حدود ۸۰۰ متر',
    needSubmit: 'شروع کشف',
    needWorking: 'در حال تحلیل نیاز...',
    examplesLabel: 'نمونه‌ها',
    examples: [
      'برای ساختمان ۲۰۰ متر سرامیک کف می‌خوام',
      'دنبال کابینت‌ساز در تهران هستم',
      'سنگ سفید اقتصادی برای لابی، ۸۰۰ متر',
    ],
    journeyTitle: 'مسیر خریدار',
    journey: [
      { title: 'نیاز', body: 'توضیح طبیعی پروژه، متن یا تصویر' },
      { title: 'کشف', body: 'جستجو روی کالاهای موجود' },
      { title: 'مقایسه و قیمت', body: 'مقایسه، RFQ، Quote و سفارش' },
    ],
    catalogTitle: 'کاتالوگ عمومی',
    catalogSubtitle: 'کالاهای موجود در سایت.',
    searchTitle: 'نتایج جستجو',
    searchSubtitle: 'نتایج از موتور جستجوی واحد روی داده‌های واقعی پیتاکیلید',
    noResults: 'نتیجه‌ای پیدا نشد. نیاز را دقیق‌تر بنویس یا از کاتالوگ مرور کن.',
    viewListing: 'مشاهده',
    price: 'قیمت',
    available: 'موجودی قابل نمایش',
    moq: 'حداقل سفارش',
    leadTime: 'زمان تأمین',
    seller: 'فروشنده',
    facility: 'محل تأمین',
    category: 'دسته',
    specs: 'مشخصات',
    askPrice: 'درخواست قیمت (به‌زودی)',
    days: 'روز',
    clarifying: 'برای ادامه، این موردها لازم است',
    intentProduct: 'محصول',
    intentProfessional: 'متخصص',
    intentDesign: 'طراحی',
    intentAmbiguous: 'نیاز به شفاف‌سازی',
    professionalHint: 'این درخواست به سمت کشف متخصص هدایت شد. بخش Professionals جدا از Checkout محصول است.',
    designHint: 'مسیر طراحی باز شد.',
    rfqHint: 'می‌توانی از کالاها ادامه دهی.',
    errorGeneric: 'خطایی رخ داد. دوباره تلاش کن.',
    footer: 'پیتاکیلید — مارکت‌پلیس B2B مصالح و خدمات ساختمانی',
    marketIran: 'بازار ایران',
    marketIntl: 'بازار بین‌الملل',
  },
  en: {
    brand: 'Peytakilid',
    tagline: 'From project need to building materials and services',
    navHome: 'Home',
    navCatalog: 'Catalog',
    navSearch: 'Search',
    needTitle: 'Describe your project need',
    needSubtitle:
      'You do not need the exact product name. Write the need in natural language; Peytakilid structures it and shows only real listings.',
    needPlaceholder: 'e.g. White stone with grey veins for a hotel lobby, about 800 m²',
    needSubmit: 'Start discovery',
    needWorking: 'Understanding your need...',
    examplesLabel: 'Examples',
    examples: [
      'I need 200 m² floor ceramic for a building',
      'Looking for a cabinet maker in Tehran',
      'Affordable white stone for lobby, 800 m²',
    ],
    journeyTitle: 'Buyer journey',
    journey: [
      { title: 'Need', body: 'Natural project brief, text or image' },
      { title: 'Discovery', body: 'Search catalog products' },
      { title: 'Compare & price', body: 'Compare, RFQ, Quote, then Order' },
    ],
    catalogTitle: 'Public catalog',
    catalogSubtitle: 'Published listings only. Private seller cost and inventory never appear.',
    searchTitle: 'Search results',
    searchSubtitle: 'Results from the unified search engine over real Peytakilid data',
    noResults: 'No results. Refine the need or browse the catalog.',
    viewListing: 'View listing',
    price: 'Price',
    available: 'Available',
    moq: 'MOQ',
    leadTime: 'Lead time',
    seller: 'Seller',
    facility: 'Supply location',
    category: 'Category',
    specs: 'Specifications',
    askPrice: 'Request quote (soon)',
    days: 'days',
    clarifying: 'To continue, we need these details',
    intentProduct: 'Product',
    intentProfessional: 'Professional',
    intentDesign: 'Design',
    intentAmbiguous: 'Needs clarification',
    professionalHint: 'This request routes to professional discovery. Professionals stay separate from product checkout.',
    designHint: 'Design assist detected. Design AI will later bind to a real listing; related results may appear now.',
    rfqHint: 'An RFQ draft fits this need better. You can continue from listings.',
    errorGeneric: 'Something went wrong. Please try again.',
    footer: 'Peytakilid — B2B marketplace for building materials and services',
    marketIran: 'Iran market',
    marketIntl: 'International',
  },
  ar: {
    brand: 'بيتاكيلد',
    tagline: 'من احتياج المشروع إلى مواد وخدمات البناء',
    navHome: 'الرئيسية',
    navCatalog: 'الكتالوج',
    navSearch: 'بحث',
    needTitle: 'صف احتياج مشروعك',
    needSubtitle:
      'لا تحتاج اسم المنتج الدقيق. اكتب احتياجك بلغة طبيعية؛ النظام يبنيه ويعرض فقط القوائم الحقيقية.',
    needPlaceholder: 'مثلاً: حجر أبيض بعروق رمادية لبهو فندق، حوالي 800 م²',
    needSubmit: 'ابدأ الاكتشاف',
    needWorking: 'جارٍ فهم الاحتياج...',
    examplesLabel: 'أمثلة',
    examples: [
      'أحتاج 200 م² سيراميك أرضيات لمبنى',
      'أبحث عن صانع خزائن في طهران',
      'حجر أبيض اقتصادي للبهو، 800 م²',
    ],
    journeyTitle: 'رحلة المشتري',
    journey: [
      { title: 'الاحتياج', body: 'وصف طبيعي للمشروع نصاً أو صورة' },
      { title: 'الاكتشاف', body: 'ابحث في المنتجات المتوفرة' },
      { title: 'المقارنة والسعر', body: 'مقارنة وRFQ وQuote ثم الطلب' },
    ],
    catalogTitle: 'الكتالوج العام',
    catalogSubtitle: 'القوائم المنشورة فقط. لا تُعرض تكلفة البائع أو مخزونه الخاص.',
    searchTitle: 'نتائج البحث',
    searchSubtitle: 'نتائج من محرك بحث موحّد على بيانات بيتاكيلد الحقيقية',
    noResults: 'لا نتائج. وضّح الاحتياج أو تصفّح الكتالوج.',
    viewListing: 'عرض القائمة',
    price: 'السعر',
    available: 'المتاح',
    moq: 'الحد الأدنى',
    leadTime: 'مدة التوريد',
    seller: 'البائع',
    facility: 'موقع التوريد',
    category: 'الفئة',
    specs: 'المواصفات',
    askPrice: 'طلب عرض سعر (قريباً)',
    days: 'يوم',
    clarifying: 'للمتابعة نحتاج هذه التفاصيل',
    intentProduct: 'منتج',
    intentProfessional: 'مختص',
    intentDesign: 'تصميم',
    intentAmbiguous: 'يحتاج توضيحاً',
    professionalHint: 'هذا الطلب يتجه لاكتشاف المختصين، منفصلاً عن شراء المنتج.',
    designHint: 'تم رصد طلب تصميم. سيرتبط لاحقاً بقائمة حقيقية؛ قد تظهر نتائج ذات صلة الآن.',
    rfqHint: 'مسودة RFQ أنسب لهذا الاحتياج. يمكنك المتابعة من القوائم.',
    errorGeneric: 'حدث خطأ. حاول مرة أخرى.',
    footer: 'بيتاكيلد — سوق B2B لمواد وخدمات البناء',
    marketIran: 'سوق إيران',
    marketIntl: 'دولي',
  },
};

export function getCopy(locale: string): Copy {
  if (locale === 'en' || locale === 'ar' || locale === 'fa') return COPY[locale];
  return COPY.fa;
}

export function isUiLocale(code: string): code is UiLocale {
  return code === 'fa' || code === 'en' || code === 'ar';
}
