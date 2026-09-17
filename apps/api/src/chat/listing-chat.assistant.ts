import { ChatSenderRole, ListingStatus } from '@prisma/client';

type ListingFacts = {
  title: string;
  description?: string | null;
  uomCode: string;
  moq?: { toString(): string } | number | null;
  leadTimeDays?: number | null;
  organization?: { name?: string | null } | null;
  facility?: { city?: string | null; province?: string | null } | null;
  price?: {
    displayPrice?: { toString(): string } | number | null;
    currency?: string | null;
  } | null;
  inventory?: {
    available?: { toString(): string } | number | null;
    uomCode?: string | null;
  } | null;
  category?: { nameFa?: string | null; nameEn?: string | null } | null;
  status: ListingStatus;
};

/**
 * Fact-only assistant for listing chat.
 * Never invents price/stock — only restates published listing fields.
 */
export function buildListingAssistantReply(
  listing: ListingFacts,
  buyerText: string,
  locale = 'fa',
): string | null {
  const q = (buyerText || '').trim();
  if (q.length < 2) return null;

  const asksPrice = /قیمت|نرخ|چنده|چقدر|price|cost|how\s*much/i.test(q);
  const asksStock = /موجود|موجودی|دارید|داری|stock|available|availability/i.test(q);
  const asksMoq = /حداقل|moq|سفارش\s*حداقل|minimum/i.test(q);
  const asksLead = /تحویل|لید\s*تایم|lead\s*time|چند\s*روز|زمان\s*ارسال/i.test(q);
  const asksWhere = /کجا|شهر|محل|انبار|where|city|location/i.test(q);
  const asksGeneral = /اطلاعات|مشخصات|جزئیات|بگو|info|detail|spec/i.test(q);

  if (!asksPrice && !asksStock && !asksMoq && !asksLead && !asksWhere && !asksGeneral) {
    return null;
  }

  const fa = locale === 'fa' || locale === 'ar';
  const lines: string[] = [];
  const title = listing.title;
  const seller = listing.organization?.name || (fa ? 'فروشنده' : 'Seller');

  if (fa) {
    lines.push(`پاسخ خودکار بر اساس آگهی «${title}» (${seller}):`);
  } else {
    lines.push(`Auto-reply from listing “${title}” (${seller}):`);
  }

  if (asksPrice || asksGeneral) {
    const price = listing.price?.displayPrice != null ? String(listing.price.displayPrice) : null;
    const currency = listing.price?.currency || '';
    if (price) {
      lines.push(
        fa
          ? `• قیمت نمایشی: ${price} ${currency} / ${listing.uomCode}`
          : `• Display price: ${price} ${currency} / ${listing.uomCode}`,
      );
    } else {
      lines.push(fa ? '• قیمت نمایشی ثبت نشده — از فروشنده بپرسید.' : '• No display price — ask the seller.');
    }
  }

  if (asksStock || asksGeneral) {
    const avail = listing.inventory?.available != null ? String(listing.inventory.available) : null;
    const uom = listing.inventory?.uomCode || listing.uomCode;
    if (avail != null) {
      lines.push(fa ? `• موجودی اعلام‌شده: ${avail} ${uom}` : `• Listed availability: ${avail} ${uom}`);
    } else {
      lines.push(fa ? '• موجودی عمومی ثبت نشده.' : '• Public availability not listed.');
    }
  }

  if (asksMoq || asksGeneral) {
    const moq = listing.moq != null ? String(listing.moq) : null;
    if (moq) {
      lines.push(fa ? `• حداقل سفارش (MOQ): ${moq} ${listing.uomCode}` : `• MOQ: ${moq} ${listing.uomCode}`);
    }
  }

  if (asksLead || asksGeneral) {
    if (listing.leadTimeDays != null) {
      lines.push(
        fa
          ? `• زمان تحویل تقریبی: ${listing.leadTimeDays} روز`
          : `• Lead time: ${listing.leadTimeDays} days`,
      );
    }
  }

  if (asksWhere || asksGeneral) {
    const place = [listing.facility?.city, listing.facility?.province].filter(Boolean).join('، ');
    if (place) {
      lines.push(fa ? `• محل تأمین: ${place}` : `• Supply location: ${place}`);
    }
  }

  lines.push(
    fa
      ? 'فروشنده هم پیام شما را می‌بیند و پاسخ می‌دهد.'
      : 'The seller can also see your message and reply.',
  );

  return lines.join('\n');
}

export { ChatSenderRole };
