/**
 * Building-industry product categories + professional trades for NL routing / UI.
 * Keys are stable English codes used in intent, search, and forms.
 */

export type BuildingCategoryDef = {
  hint: string;
  slug: string;
  nameEn: string;
  nameFa: string;
  /** FA / EN surface forms matched in prompts (plain strings → regex in API). */
  terms: string[];
};

export type BuildingSpecialtyDef = {
  code: string;
  nameEn: string;
  nameFa: string;
  terms: string[];
};

/** Product / material categories used by homepage search and seller wizard. */
export const BUILDING_CATEGORIES: BuildingCategoryDef[] = [
  { hint: 'tile', slug: 'ceramic-tile', nameEn: 'Ceramic Tile', nameFa: 'سرامیک', terms: ['tile', 'tiles', 'کاشی', 'سرامیک'] },
  { hint: 'porcelain', slug: 'porcelain-tile', nameEn: 'Porcelain Tile', nameFa: 'پرسلان', terms: ['porcelain', 'پرسلان', 'پرسلین'] },
  { hint: 'stone', slug: 'natural-stone', nameEn: 'Natural Stone', nameFa: 'سنگ طبیعی', terms: ['stone', 'marble', 'granite', 'travertine', 'سنگ', 'مرمر', 'گرانیت', 'تراورتن', 'اونیکس'] },
  { hint: 'laminate', slug: 'laminate-flooring', nameEn: 'Laminate Flooring', nameFa: 'پارکت لمینت', terms: ['laminate', 'flooring', 'parquet', 'لمینت', 'پارکت', 'کفپوش', 'کف پوش'] },
  { hint: 'carpet', slug: 'carpet-rugs', nameEn: 'Carpet & Rugs', nameFa: 'موکت و فرش', terms: ['carpet', 'rug', 'موکت', 'فرش'] },
  { hint: 'cement', slug: 'cement-concrete', nameEn: 'Cement & Concrete', nameFa: 'سیمان و بتن', terms: ['cement', 'concrete', 'سیمان', 'بتن', 'ملات'] },
  { hint: 'rebar', slug: 'steel-rebar', nameEn: 'Steel & Rebar', nameFa: 'فولاد و میلگرد', terms: ['rebar', 'steel bar', 'میلگرد', 'آرماتور', 'تیرآهن', 'نبشی', 'ناودانی'] },
  { hint: 'brick', slug: 'brick-block', nameEn: 'Brick & Block', nameFa: 'آجر و بلوک', terms: ['brick', 'block', 'آجر', 'بلوک', 'بلوک سیمانی', 'سفال'] },
  { hint: 'gypsum', slug: 'gypsum-plaster', nameEn: 'Gypsum & Plaster', nameFa: 'گچ و اندود', terms: ['gypsum', 'plaster', 'گچ', 'اندود', 'گچ برگ', 'کناف'] },
  { hint: 'paint', slug: 'paint-coatings', nameEn: 'Paint & Coatings', nameFa: 'رنگ و پوشش', terms: ['paint', 'coating', 'رنگ', 'رنگ ساختمانی', 'رنگ روغن', 'رنگ پلاستیک', 'پرایمر'] },
  { hint: 'insulation', slug: 'insulation', nameEn: 'Insulation', nameFa: 'عایق', terms: ['insulation', 'عایق', 'پشم سنگ', 'پشم شیشه', 'یونولیت', 'فوم'] },
  { hint: 'waterproofing', slug: 'waterproofing', nameEn: 'Waterproofing', nameFa: 'عایق رطوبتی', terms: ['waterproof', 'waterproofing', 'ایزوگام', 'قیر', 'عایق رطوبتی', 'نم‌بندی', 'نمنایی'] },
  { hint: 'door', slug: 'doors', nameEn: 'Doors', nameFa: 'درب', terms: ['door', 'doors', 'درب', 'در ضد سرقت', 'درب چوبی'] },
  { hint: 'window', slug: 'windows', nameEn: 'Windows', nameFa: 'پنجره', terms: ['window', 'windows', 'upvc', 'upcvc', 'پنجره', 'یو پی وی سی', 'یوپی‌وی‌سی', 'آلومینیوم پنجره'] },
  { hint: 'cabinet', slug: 'cabinets', nameEn: 'Cabinets', nameFa: 'کابینت', terms: ['cabinet', 'cabinets', 'کابینت', 'کابینت آشپزخانه'] },
  { hint: 'sanitary', slug: 'sanitaryware', nameEn: 'Sanitaryware', nameFa: 'چینی بهداشتی', terms: ['sanitary', 'toilet', 'sink', 'washbasin', 'توالت', 'روشویی', 'چینی بهداشتی', 'کاسه توالت', 'زیردوشی'] },
  { hint: 'faucet', slug: 'faucets-fixtures', nameEn: 'Faucets & Fixtures', nameFa: 'شیرآلات', terms: ['faucet', 'tap', 'fixture', 'شیرآلات', 'شیر آب', 'مخلوط‌کن'] },
  { hint: 'pipe', slug: 'pipes-fittings', nameEn: 'Pipes & Fittings', nameFa: 'لوله و اتصالات', terms: ['pipe', 'pipes', 'fitting', 'لوله', 'اتصالات', 'لوله کشی', 'pvc', 'پلی‌اتیلن', 'پلی اتیلن'] },
  { hint: 'electrical', slug: 'electrical-supplies', nameEn: 'Electrical Supplies', nameFa: 'لوازم برقی', terms: ['electrical', 'wire', 'cable', 'switch', 'سیم', 'کابل', 'کلید و پریز', 'جعبه فیوز', 'تابلو برق'] },
  { hint: 'lighting', slug: 'lighting', nameEn: 'Lighting', nameFa: 'روشنایی', terms: ['lighting', 'lamp', 'led', 'چراغ', 'لوستر', 'روشنایی', 'هالوژن'] },
  { hint: 'hvac', slug: 'hvac', nameEn: 'HVAC', nameFa: 'تاسیسات حرارتی', terms: ['hvac', 'heater', 'radiator', 'boiler', 'اسپیلت', 'اسپلیت', 'کولر', 'پکیج', 'رادیاتور', 'دیگ', 'بخاری', 'چیلر', 'هواساز'] },
  { hint: 'glass', slug: 'glass-mirrors', nameEn: 'Glass & Mirrors', nameFa: 'شیشه و آینه', terms: ['glass', 'mirror', 'شیشه', 'آینه', 'سکوریت'] },
  { hint: 'wood', slug: 'wood-timber', nameEn: 'Wood & Timber', nameFa: 'چوب و MDF', terms: ['wood', 'timber', 'mdf', 'چوب', 'ام دی اف', 'نئوپان', 'ترموود'] },
  { hint: 'metalwork', slug: 'metalwork', nameEn: 'Metalwork', nameFa: 'فلزکاری و آهن‌آلات', terms: ['metal', 'ironwork', 'آهن', 'ورق', 'پروفیل', 'نرده', 'حفاظ'] },
  { hint: 'scaffold', slug: 'scaffolding', nameEn: 'Scaffolding', nameFa: 'داربست', terms: ['scaffold', 'scaffolding', 'داربست'] },
  { hint: 'elevator', slug: 'elevators', nameEn: 'Elevators', nameFa: 'آسانسور', terms: ['elevator', 'lift', 'آسانسور', 'بالابر'] },
  { hint: 'security', slug: 'security-systems', nameEn: 'Security Systems', nameFa: 'سیستم‌های امنیتی', terms: ['cctv', 'alarm', 'دوربین مداربسته', 'دزدگیر', 'آیفون تصویری'] },
  { hint: 'landscape', slug: 'landscape-garden', nameEn: 'Landscape & Garden', nameFa: 'محوطه‌سازی', terms: ['landscape', 'garden', 'محوطه', 'محوطه‌سازی', 'چمن مصنوعی', 'آلاچیق'] },
  { hint: 'adhesive', slug: 'adhesives-sealants', nameEn: 'Adhesives & Sealants', nameFa: 'چسب و درزگیر', terms: ['adhesive', 'sealant', 'چسب', 'چسب کاشی', 'سیلیکون', 'درزگیر'] },
  { hint: 'epoxy', slug: 'epoxy-flooring', nameEn: 'Epoxy Flooring', nameFa: 'کفپوش اپوکسی', terms: ['epoxy', 'اپوکسی', 'کفپوش اپوکسی'] },
  { hint: 'solar', slug: 'solar-energy', nameEn: 'Solar Energy', nameFa: 'انرژی خورشیدی', terms: ['solar', 'پنل خورشیدی', 'سولار'] },
  { hint: 'wallpaper', slug: 'wallpaper', nameEn: 'Wallpaper', nameFa: 'کاغذ دیواری', terms: ['wallpaper', 'کاغذ دیواری', 'کاغذدیواری'] },
  { hint: 'false_ceiling', slug: 'false-ceiling', nameEn: 'False Ceiling', nameFa: 'سقف کاذب', terms: ['false ceiling', 'سقف کاذب', 'تایل سقفی'] },
];

/** Professional / trade specialties for find-pro and register-pro journeys. */
export const BUILDING_SPECIALTIES: BuildingSpecialtyDef[] = [
  { code: 'architecture', nameEn: 'Architect', nameFa: 'معمار', terms: ['architect', 'architecture', 'معمار', 'معماری'] },
  { code: 'civil_engineering', nameEn: 'Civil Engineer', nameFa: 'مهندس عمران', terms: ['civil engineer', 'مهندس عمران', 'عمران'] },
  { code: 'structural_engineering', nameEn: 'Structural Engineer', nameFa: 'مهندس سازه', terms: ['structural engineer', 'مهندس سازه', 'سازه'] },
  { code: 'interior_design', nameEn: 'Interior Designer', nameFa: 'طراح داخلی', terms: ['interior designer', 'interior design', 'طراح داخلی', 'دکوراسیون', 'طراح'] },
  { code: 'contracting', nameEn: 'General Contractor', nameFa: 'پیمانکار', terms: ['contractor', 'پیمانکار', 'مقاول', 'مجری'] },
  { code: 'project_management', nameEn: 'Project Manager', nameFa: 'مدیر پروژه', terms: ['project manager', 'مدیر پروژه', 'سرپرست کارگاه'] },
  { code: 'installation', nameEn: 'Installer', nameFa: 'نصاب', terms: ['installer', 'installation', 'نصاب', 'نصب'] },
  { code: 'tile_installation', nameEn: 'Tile / Ceramic Installer', nameFa: 'سرامیک‌کار', terms: ['tile installer', 'tiler', 'سرامیک کار', 'سرامیک‌کار', 'کاشی کار', 'کاشی‌کار'] },
  { code: 'stone_installation', nameEn: 'Stone Mason', nameFa: 'سنگ‌کار', terms: ['stone mason', 'stonemason', 'سنگ کار', 'سنگ‌کار', 'سنگکار'] },
  { code: 'plastering', nameEn: 'Plasterer', nameFa: 'گچ‌کار', terms: ['plasterer', 'plastering', 'گچ کار', 'گچ‌کار', 'گچکار', 'سفیدکار'] },
  { code: 'drywall', nameEn: 'Drywall / Knauf', nameFa: 'کناف‌کار', terms: ['drywall', 'knauf', 'کناف', 'کناف کار', 'کناف‌کار', 'رابیس'] },
  { code: 'painting', nameEn: 'Painter', nameFa: 'نقاش ساختمان', terms: ['painter', 'painting', 'نقاش', 'نقاش ساختمان'] },
  { code: 'electrical', nameEn: 'Electrician', nameFa: 'برقکار', terms: ['electrician', 'electrical', 'برق کار', 'برق‌کار', 'برقکار'] },
  { code: 'plumbing', nameEn: 'Plumber', nameFa: 'لوله‌کش', terms: ['plumber', 'plumbing', 'لوله کش', 'لوله‌کش', 'لوله\u200cکش', 'تاسیساتی'] },
  { code: 'hvac_tech', nameEn: 'HVAC Technician', nameFa: 'تکنسین تهویه', terms: ['hvac', 'ac technician', 'کولر گاز', 'اسپلیت', 'پکیج کار', 'پکیج‌کار', 'تهویه مطبوع'] },
  { code: 'welding', nameEn: 'Welder', nameFa: 'جوشکار', terms: ['welder', 'welding', 'جوشکار', 'جوش کاری'] },
  { code: 'metalwork', nameEn: 'Metalworker', nameFa: 'آهنگر / فلزکار', terms: ['metalworker', 'blacksmith', 'آهنگر', 'فلزکار', 'در و پنجره ساز'] },
  { code: 'carpentry', nameEn: 'Carpenter', nameFa: 'نجار', terms: ['carpenter', 'carpentry', 'نجار', 'چوب کار', 'چوب‌کار'] },
  { code: 'cabinet_making', nameEn: 'Cabinet Maker', nameFa: 'کابینت‌ساز', terms: ['cabinet maker', 'کابینت ساز', 'کابینت‌ساز', 'کابینتساز'] },
  { code: 'upvc_install', nameEn: 'UPVC Installer', nameFa: 'نصاب UPVC', terms: ['upvc installer', 'نصاب upvc', 'نصاب یو پی وی سی', 'پنجره کار', 'پنجره‌کار'] },
  { code: 'waterproofing', nameEn: 'Waterproofing Specialist', nameFa: 'عایق‌کار', terms: ['waterproofing', 'ایزوگام کار', 'ایزوگام‌کار', 'عایق کار', 'عایق‌کار'] },
  { code: 'flooring_install', nameEn: 'Flooring Installer', nameFa: 'کفپوش‌کار', terms: ['flooring installer', 'کفپوش کار', 'کفپوش‌کار', 'پارکت کار', 'پارکت‌کار', 'لمینت کار'] },
  { code: 'glasswork', nameEn: 'Glazier', nameFa: 'شیشه‌بر', terms: ['glazier', 'شیشه بر', 'شیشه‌بر', 'شیشه\u200cبر'] },
  { code: 'facade', nameEn: 'Facade Specialist', nameFa: 'نمای ساختمان', terms: ['facade', 'نما کار', 'نماکار', 'نمای کامپوزیت', 'نمای سنگ'] },
  { code: 'scaffolding', nameEn: 'Scaffolder', nameFa: 'داربست‌بند', terms: ['scaffolder', 'داربست بند', 'داربست‌بند'] },
  { code: 'excavation', nameEn: 'Excavation', nameFa: 'خاکبرداری', terms: ['excavation', 'excavator', 'خاکبرداری', 'گودبرداری'] },
  { code: 'concrete_work', nameEn: 'Concrete Worker', nameFa: 'بتن‌ریز', terms: ['concrete worker', 'بتن ریز', 'بتن‌ریز', 'آرماتوربند', 'آرماتور بند'] },
  { code: 'masonry', nameEn: 'Bricklayer', nameFa: 'بنا / آجرچین', terms: ['bricklayer', 'mason', 'بنا', 'آجرچین', 'دیوارچینی', 'سفت\u200cکاری', 'سفت کاری'] },
  { code: 'roofing', nameEn: 'Roofer', nameFa: 'سقف‌کار', terms: ['roofer', 'roofing', 'سقف کار', 'سقف‌کار', 'شیروانی'] },
  { code: 'elevator_tech', nameEn: 'Elevator Technician', nameFa: 'سرویس آسانسور', terms: ['elevator', 'آسانسور کار', 'آسانسورکار', 'سرویسکار آسانسور'] },
  { code: 'security_install', nameEn: 'Security Installer', nameFa: 'نصاب دوربین', terms: ['cctv installer', 'نصاب دوربین', 'دوربین مدار بسته', 'اعلام حریق'] },
  { code: 'landscape', nameEn: 'Landscaper', nameFa: 'محوطه‌ساز', terms: ['landscaper', 'محوطه ساز', 'محوطه‌ساز', 'فضای سبز'] },
  { code: 'surveying', nameEn: 'Surveyor', nameFa: 'نقشه‌بردار', terms: ['surveyor', 'نقشه بردار', 'نقشه‌بردار'] },
  { code: 'inspection', nameEn: 'Building Inspector', nameFa: 'ناظر ساختمان', terms: ['inspector', 'ناظر', 'ناظر ساختمان', 'نظام مهندسی'] },
  { code: 'demolition', nameEn: 'Demolition', nameFa: 'تخریب', terms: ['demolition', 'تخریب', 'تخریبچی'] },
  { code: 'cleaning', nameEn: 'Building Cleaning', nameFa: 'نظافت ساختمان', terms: ['cleaning', 'نظافت ساختمان', 'نماشویی'] },
  { code: 'fabrication', nameEn: 'Fabricator', nameFa: 'سازنده / فابریکاتور', terms: ['fabricator', 'fabrication', 'برش', 'ساخت سفارشی'] },
  { code: 'tiling_mosaic', nameEn: 'Mosaic Artist', nameFa: 'کاشی‌معرق', terms: ['mosaic', 'معرق', 'کاشی معرق'] },
  { code: 'epoxy_floor', nameEn: 'Epoxy Flooring', nameFa: 'کفپوش اپوکسی', terms: ['epoxy', 'اپوکسی', 'کفپوش اپوکسی'] },
  { code: 'pool_construction', nameEn: 'Pool Builder', nameFa: 'استخرساز', terms: ['pool builder', 'استخر', 'استخرساز', 'جکوزی'] },
  { code: 'sauna_spa', nameEn: 'Sauna / Spa Installer', nameFa: 'نصاب سونا', terms: ['sauna', 'سونا', 'جکوزی ساز'] },
  { code: 'smart_home', nameEn: 'Smart Home Installer', nameFa: 'خانه هوشمند', terms: ['smart home', 'خانه هوشمند', 'خانه\u200cهوشمند', 'بی‌ام‌اس', 'bms'] },
  { code: 'solar', nameEn: 'Solar Installer', nameFa: 'نصاب پنل خورشیدی', terms: ['solar', 'پنل خورشیدی', 'سولار', 'انرژی خورشیدی'] },
  { code: 'gas_fitting', nameEn: 'Gas Fitter', nameFa: 'گازکش', terms: ['gas fitter', 'گازکش', 'لوله کشی گاز', 'علمک گاز'] },
  { code: 'sewage', nameEn: 'Sewage Specialist', nameFa: 'فاضلاب', terms: ['sewage', 'فاضلاب', 'چاه جذبی', 'لجن‌کش'] },
  { code: 'asphalt', nameEn: 'Asphalt / Paving', nameFa: 'آسفالت‌کار', terms: ['asphalt', 'آسفالت', 'آسفالت کار', 'جدول‌گذاری'] },
  { code: 'concrete_pump', nameEn: 'Concrete Pump Operator', nameFa: 'پمپ بتن', terms: ['concrete pump', 'پمپ بتن', 'تراک میکسر'] },
  { code: 'crane', nameEn: 'Crane Operator', nameFa: 'اپراتور جرثقیل', terms: ['crane', 'جرثقیل', 'تاورکرین'] },
  { code: 'formwork', nameEn: 'Formwork Carpenter', nameFa: 'قالب‌بند', terms: ['formwork', 'قالب بند', 'قالب‌بند', 'داربست قالب'] },
  { code: 'rebar_tying', nameEn: 'Rebar Worker', nameFa: 'آرماتوربند', terms: ['rebar worker', 'آرماتوربند', 'آرماتور بند', 'آرماتورکار'] },
  { code: 'insulation_tech', nameEn: 'Insulation Technician', nameFa: 'عایق حرارتی', terms: ['insulation tech', 'عایق حرارتی', 'پشم سنگ کار'] },
  { code: 'aluminum_work', nameEn: 'Aluminum Fabricator', nameFa: 'آلومینیوم‌کار', terms: ['aluminum', 'آلومینیوم کار', 'آلومینیوم‌کار', 'کرکره برقی'] },
  { code: 'blinds_curtains', nameEn: 'Blinds Installer', nameFa: 'پرده و کرکره', terms: ['blinds', 'پرده', 'کرکره', 'پرده زبرا'] },
  { code: 'kitchen_install', nameEn: 'Kitchen Installer', nameFa: 'نصاب آشپزخانه', terms: ['kitchen installer', 'نصاب آشپزخانه', 'صفحه کابینت'] },
  { code: 'fireplace', nameEn: 'Fireplace Installer', nameFa: 'شومینه‌کار', terms: ['fireplace', 'شومینه', 'شومینه کار'] },
  { code: 'false_ceiling', nameEn: 'False Ceiling', nameFa: 'سقف کاذب', terms: ['false ceiling', 'سقف کاذب', 'تایل سقفی'] },
  { code: 'wallpaper', nameEn: 'Wallpaper Installer', nameFa: 'کاغذدیواری', terms: ['wallpaper', 'کاغذ دیواری', 'کاغذدیواری', 'پوستر دیواری'] },
  { code: 'stone_cnc', nameEn: 'Stone CNC / Cutting', nameFa: 'برش سنگ CNC', terms: ['stone cnc', 'برش سنگ', 'فرز سنگ', 'واترجت'] },
  { code: 'quantity_survey', nameEn: 'Quantity Surveyor', nameFa: 'مترور', terms: ['quantity surveyor', 'مترور', 'برآورد هزینه', 'آنالیز بها'] },
];

export const BUILDING_SPECIALTY_CODES = BUILDING_SPECIALTIES.map((s) => s.code);
