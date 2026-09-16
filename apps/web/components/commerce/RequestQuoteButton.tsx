'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  apiAuthed,
  fetchMe,
  getAccessToken,
} from '@/lib/auth-client';
import type { Locale } from '@/lib/i18n-public';

type OrgMem = {
  orgRole: string;
  organization: { id: string; name: string; slug: string; canBuy?: boolean };
};

/**
 * Listing → RFQ draft → submit → buyer panel.
 * Ensures buyer org exists (creates one if logged-in user has none).
 */
export function RequestQuoteButton({
  locale,
  copy,
  listingId,
  listingTitle,
  uomCode,
  defaultQty = 1,
}: {
  locale: Locale;
  copy: Record<string, string>;
  listingId: string;
  listingTitle: string;
  uomCode?: string | null;
  defaultQty?: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [qty, setQty] = useState(String(defaultQty));
  const [error, setError] = useState('');

  async function ensureBuyerOrgId(): Promise<string> {
    const me = await fetchMe();
    const memberships = await apiAuthed<OrgMem[]>('/organizations');
    const buyable = (memberships || [])
      .map((m) => m.organization)
      .find((o) => o.canBuy !== false);
    if (buyable) return buyable.id;

    const slugBase = (me.email.split('@')[0] || 'buyer')
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .slice(0, 24);
    const org = await apiAuthed<{ id: string }>('/organizations', {
      method: 'POST',
      json: {
        name: me.fullName || me.email || 'Buyer Org',
        slug: `${slugBase}-buyer-${Date.now().toString(36).slice(-4)}`,
        canBuy: true,
        canSell: false,
        isProfessional: false,
      },
    });
    return org.id;
  }

  async function onRequest() {
    setError('');
    if (!getAccessToken()) {
      router.push(`/${locale}/login?next=${encodeURIComponent(`/${locale}/catalog`)}`);
      return;
    }
    setBusy(true);
    try {
      const buyerOrganizationId = await ensureBuyerOrgId();
      const quantity = Math.max(0.0001, Number(qty) || 1);
      const uom = uomCode || 'm2';
      const draft = await apiAuthed<{ id: string }>('/buyer/rfqs/draft', {
        method: 'POST',
        json: {
          buyerOrganizationId,
          selectedListingIds: [listingId],
          buyerNotes: `${copy.rfq_note_prefix} ${listingTitle}`,
          requirements: {
            intent: 'PRODUCT',
            market: 'IRAN',
            locale,
            quantity,
            uomCode: uom,
            categoryHints: [],
            attributeFilters: {},
            listingIdHints: [listingId],
            specialtyHints: [],
            confidence: 1,
            missingFields: [],
            rawText: listingTitle,
          },
          items: [
            {
              listingId,
              quantity,
              uomCode: uom,
            },
          ],
        },
      });
      await apiAuthed(`/buyer/rfqs/${draft.id}/submit`, { method: 'POST' });
      router.push(`/${locale}/buyer?tab=rfqs&highlight=${draft.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.rfq_failed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rfq-cta">
      <label className="rfq-cta__qty">
        {copy.rfq_qty}
        <input
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          inputMode="decimal"
          disabled={busy}
        />
        <span>{uomCode || 'uom'}</span>
      </label>
      <button className="mp-btn mp-btn--primary" type="button" disabled={busy} onClick={() => void onRequest()}>
        {busy ? '…' : copy.listing_ask_rfq}
      </button>
      {error ? <p className="panel-err">{error}</p> : null}
    </div>
  );
}
