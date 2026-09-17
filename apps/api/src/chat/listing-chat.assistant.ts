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

export type AssistantOutcome = {
  reply: string | null;
  /** Buyer explicitly asked for human/admin, or bot cannot answer a real question. */
  shouldEscalate: boolean;
  escalationReason: string | null;
};

const HUMAN_ADMIN_RE =
  /ادمین|اپراتور|پشتیبانی|پشتیبان|انسان|اپراتور\s*سایت|با\s*آدم|با\s*انسان|human|admin|support|operator|real\s*person|live\s*agent|speak\s*to\s*(a\s*)?(human|agent|admin)/i;

const QUESTIONISH_RE =
  /\?|؟|چی|چطور|چگونه|کجا|کی|آیا|میشه|می‌شه|لطفا|لطفاً|قیمت|موجود|سفارش|خرید|how|what|where|when|can\s*you|please|need|help/i;

/**
 * Fact-only assistant for listing chat.
 * Never invents price/stock — only restates published listing fields.
 * Escalates to site admin when the buyer asks for a human or the bot cannot help.
 */
export function buildListingAssistantOutcome(
  listing: ListingFacts,
  buyerText: string,
  locale = 'fa',
): AssistantOutcome {
  const q = (buyerText || '').trim();
  if (q.length < 2) {
    return { reply: null, shouldEscalate: false, escalationReason: null };
  }

  const fa = locale === 'fa' || locale === 'ar';
  const wantsHuman = HUMAN_ADMIN_RE.test(q);

  const asksPrice = /قیمت|نرخ|چنده|چقدر|price|cost|how\s*much/i.test(q);
  const asksStock =
    /موجودی|موجود\s*(هست|است|دارید|داری)?|stock|available|availability|in\s*stock/i.test(q);
  const asksMoq = /حداقل\s*سفارش|moq|سفارش\s*حداقل|minimum\s*order/i.test(q);
  const asksLead = /تحویل|لید\s*تایم|lead\s*time|چند\s*روز|زمان\s*ارسال|shipping\s*time/i.test(q);
  const asksWhere = /کجا(?:ست|ی)?|شهر|محل\s*تأمین|انبار|where|city|location|province/i.test(q);
  const asksGeneral = /اطلاعات|مشخصات|جزئیات|بگو\s*درباره|info|detail|spec/i.test(q);
  const canAnswer =
    asksPrice || asksStock || asksMoq || asksLead || asksWhere || asksGeneral;

  if (wantsHuman) {
    return {
      reply: fa
        ? 'درخواست شما برای اتصال به پشتیبانی سایت ثبت شد. ادمین به‌زودی در همین گفتگو پاسخ می‌دهد.'
        : 'Your request to reach site support was logged. An admin will reply in this chat shortly.',
      shouldEscalate: true,
      escalationReason: 'buyer_requested_admin',
    };
  }

  if (!canAnswer) {
    const escalate = QUESTIONISH_RE.test(q) || q.length >= 12;
    if (!escalate) {
      return { reply: null, shouldEscalate: false, escalationReason: null };
    }
    return {
      reply: fa
        ? 'از روی اطلاعات همین آگهی جواب قطعی ندارم. پیام شما به پشتیبانی سایت ارجاع شد تا ادمین کمک کند. فروشنده هم می‌تواند پاسخ دهد.'
        : 'I cannot answer from this listing’s published facts. Your message was escalated to site support. The seller can also reply.',
      shouldEscalate: true,
      escalationReason: 'assistant_cannot_answer',
    };
  }

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
      ? 'فروشنده هم پیام شما را می‌بیند. برای پشتیبانی سایت بنویسید «ادمین» یا «پشتیبانی».'
      : 'The seller can also see your message. Write “admin” or “support” to reach site support.',
  );

  return {
    reply: lines.join('\n'),
    shouldEscalate: false,
    escalationReason: null,
  };
}

/** @deprecated Prefer buildListingAssistantOutcome */
export function buildListingAssistantReply(
  listing: ListingFacts,
  buyerText: string,
  locale = 'fa',
): string | null {
  return buildListingAssistantOutcome(listing, buyerText, locale).reply;
}

export { ChatSenderRole };
