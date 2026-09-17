import { ListingStatus } from '@prisma/client';
import { buildListingAssistantOutcome } from './listing-chat.assistant';

const baseListing = {
  title: 'سرامیک براق ۶۰×۶۰',
  uomCode: 'M2',
  moq: 50,
  leadTimeDays: 7,
  organization: { name: 'کاشی پارس' },
  facility: { city: 'یزد', province: 'یزد' },
  price: { displayPrice: 420000, currency: 'IRR' },
  inventory: { available: 1200, uomCode: 'M2' },
  category: { nameFa: 'سرامیک', nameEn: 'Ceramic' },
  status: ListingStatus.PUBLISHED,
};

describe('listing chat assistant escalation', () => {
  it('answers price from facts without escalating', () => {
    const out = buildListingAssistantOutcome(baseListing, 'قیمت چنده؟', 'fa');
    expect(out.shouldEscalate).toBe(false);
    expect(out.reply).toMatch(/420000/);
  });

  it('escalates when buyer asks for admin', () => {
    const out = buildListingAssistantOutcome(baseListing, 'لطفا ادمین سایت رو وصل کنید', 'fa');
    expect(out.shouldEscalate).toBe(true);
    expect(out.escalationReason).toBe('buyer_requested_admin');
    expect(out.reply).toMatch(/پشتیبانی/);
  });

  it('escalates when assistant cannot answer a real question', () => {
    const out = buildListingAssistantOutcome(
      baseListing,
      'آیا نصب رایگان هم دارید برای پروژه ویلا؟',
      'fa',
    );
    expect(out.shouldEscalate).toBe(true);
    expect(out.escalationReason).toBe('assistant_cannot_answer');
  });
});
