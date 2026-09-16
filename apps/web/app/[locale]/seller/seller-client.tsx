'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  apiAuthed,
  apiAuthedForm,
  clearTokens,
  fetchMe,
  getAccessToken,
  logout,
  type AuthUser,
} from '@/lib/auth-client';
import { apiUrl } from '@/lib/api';
import type { Locale } from '@/lib/i18n-public';
import { SellerListingWizard } from '@/components/seller/SellerListingWizard';

type Org = { id: string; name: string; slug: string; canSell?: boolean; isProfessional?: boolean };
type Facility = {
  id: string;
  name: string;
  type: string;
  status: string;
  isPublicLocation?: boolean;
  address?: { city?: string; province?: string; countryCode?: string; line1?: string };
};
type ListingMedia = {
  id: string;
  url?: string | null;
  altText?: string | null;
  status?: string;
  sortOrder?: number;
};
type Listing = {
  id: string;
  publicId?: string;
  slug: string;
  title: string;
  status: string;
  uomCode?: string;
  moq?: number | null;
  leadTimeDays?: number | null;
  rejectionReason?: string | null;
  category?: { id?: string; name?: string; nameEn?: string; slug?: string } | null;
  facility?: { id?: string; name?: string } | null;
  price?: { displayPrice?: number; currency?: string } | null;
  inventory?: { onHand?: number; reserved?: number; available?: number; uomCode?: string } | null;
  media?: ListingMedia[];
};
type Category = {
  id: string;
  parentId?: string | null;
  slug: string;
  nameEn?: string;
  nameFa?: string;
  name?: string;
  children?: Category[];
};

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48) || `org-${Date.now().toString(36)}`;
}

export default function SellerClient({
  locale,
  copy,
  initialTab,
  initialCategorySlug,
  initialCity,
  openWizard = false,
}: {
  locale: Locale;
  copy: Record<string, string>;
  initialTab?: string;
  initialCategorySlug?: string;
  initialCity?: string;
  openWizard?: boolean;
}) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [orgId, setOrgId] = useState('');
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'overview' | 'facility' | 'listing' | 'commerce'>(
    initialTab === 'facility' || initialTab === 'listing' || initialTab === 'commerce' || initialTab === 'overview'
      ? initialTab
      : openWizard
        ? 'listing'
        : 'overview',
  );  const [eligible, setEligible] = useState<
    Array<{
      rfqTargetId: string;
      listingId: string;
      listing?: { title?: string; slug?: string };
      rfq: {
        id: string;
        status: string;
        items?: Array<{ id: string; listingId?: string | null; quantity: number; uomCode: string; titleSnapshot?: string }>;
        buyer?: { name?: string };
      };
    }>
  >([]);
  const [sellerOrders, setSellerOrders] = useState<
    Array<{ id: string; status: string; totalDisplayPrice?: number; currency?: string; buyer?: { name?: string } }>
  >([]);
  const [quoteBase, setQuoteBase] = useState('10');

  // org form
  const [orgName, setOrgName] = useState('');
  const [orgSlug, setOrgSlug] = useState('');
  const [asPro, setAsPro] = useState(false);

  // facility form
  const [facName, setFacName] = useState('');
  const [facType, setFacType] = useState('FACTORY');
  const [facCity, setFacCity] = useState(initialCity || 'Tehran');
  const [facProvince, setFacProvince] = useState('Tehran');
  const [facLine1, setFacLine1] = useState('');
  const [facLat, setFacLat] = useState('35.6892');
  const [facLng, setFacLng] = useState('51.3890');
  const [facPublic, setFacPublic] = useState(true);

  const [mediaListingId, setMediaListingId] = useState('');
  const [listingMedia, setListingMedia] = useState<ListingMedia[]>([]);
  const [stockAdjust, setStockAdjust] = useState('10');
  const refresh = useCallback(async () => {
    if (!getAccessToken()) {
      const qs = new URLSearchParams();
      if (openWizard || initialTab === 'listing') {
        qs.set('tab', 'listing');
        qs.set('wizard', '1');
      } else if (initialTab) {
        qs.set('tab', initialTab);
      }
      if (initialCategorySlug) qs.set('category', initialCategorySlug);
      if (initialCity) qs.set('city', initialCity);
      const nextPath = `/${locale}/seller${qs.toString() ? `?${qs.toString()}` : ''}`;
      router.replace(`/${locale}/login?next=${encodeURIComponent(nextPath)}`);
      return;
    }
    const me = await fetchMe();
    setUser(me);
    const memberships = await apiAuthed<Array<{ orgRole: string; organization: Org }>>('/organizations');
    const myOrgs = (memberships || []).map((m) => m.organization).filter(Boolean);
    setOrgs(myOrgs);
    const preferred =
      myOrgs.find((o) => o.id === orgId) ||
      myOrgs.find((o) => o.canSell !== false) ||
      myOrgs[0];
    if (preferred) setOrgId(preferred.id);

    const cats = await fetch(apiUrl('/categories?locale=' + locale)).then((r) => r.json());
    setCategories(Array.isArray(cats) ? cats : []);
  }, [locale, orgId, router, openWizard, initialTab, initialCategorySlug, initialCity]);

  const loadOrgData = useCallback(
    async (id: string) => {
      if (!id) return;
      const [facs, lists, elig, ords] = await Promise.all([
        apiAuthed<Facility[]>(`/seller/facilities?organizationId=${encodeURIComponent(id)}`),
        apiAuthed<Listing[]>(`/seller/listings?organizationId=${encodeURIComponent(id)}`),
        apiAuthed<typeof eligible>(`/seller/rfqs/eligible?organizationId=${encodeURIComponent(id)}`).catch(
          () => [],
        ),
        apiAuthed<typeof sellerOrders>(`/seller/orders?organizationId=${encodeURIComponent(id)}`).catch(
          () => [],
        ),
      ]);
      setFacilities(facs || []);
      setListings(lists || []);
      setEligible(elig || []);
      setSellerOrders(ords || []);
    },
    [],
  );

  useEffect(() => {
    void (async () => {
      try {
        await refresh();
      } catch {
        clearTokens();
        router.replace(`/${locale}/login?next=/${locale}/seller`);
      }
    })();
  }, [locale, refresh, router]);

  useEffect(() => {
    if (orgId) void loadOrgData(orgId).catch((e) => setError(String(e.message || e)));
  }, [orgId, loadOrgData]);

  useEffect(() => {
    if (!mediaListingId) {
      setListingMedia([]);
      return;
    }
    void apiAuthed<ListingMedia[]>(`/seller/listings/${mediaListingId}/media`)
      .then((rows) => setListingMedia(rows || []))
      .catch(() => setListingMedia([]));
  }, [mediaListingId]);

  async function uploadListingPhoto(listingId: string, file: File | null) {
    if (!file || !listingId) return;
    setBusy(true);
    setError('');
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('altText', listings.find((l) => l.id === listingId)?.title || file.name);
      await apiAuthedForm(`/seller/listings/${listingId}/media`, form);
      setMsg(copy.seller_media_uploaded);
      const rows = await apiAuthed<ListingMedia[]>(`/seller/listings/${listingId}/media`);
      setListingMedia(rows || []);
      if (orgId) await loadOrgData(orgId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  }

  async function removeListingPhoto(mediaId: string) {
    if (!mediaListingId) return;
    setBusy(true);
    setError('');
    try {
      await apiAuthed(`/seller/media/${mediaId}`, { method: 'DELETE' });
      setMsg(copy.seller_media_removed);
      const rows = await apiAuthed<ListingMedia[]>(`/seller/listings/${mediaListingId}/media`);
      setListingMedia(rows || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Remove failed');
    } finally {
      setBusy(false);
    }
  }

  async function adjustStock(listingId: string, mode: 'in' | 'out') {
    const qty = Number(stockAdjust);
    if (!(qty > 0)) {
      setError(copy.seller_stock_invalid);
      return;
    }
    setBusy(true);
    setError('');
    try {
      await apiAuthed(`/seller/listings/${listingId}/inventory/${mode}`, {
        method: 'POST',
        json: { quantity: qty, note: mode === 'in' ? 'Stock in' : 'Stock out' },
      });
      setMsg(mode === 'in' ? copy.seller_stock_in_ok : copy.seller_stock_out_ok);
      if (orgId) await loadOrgData(orgId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Stock update failed');
    } finally {
      setBusy(false);
    }
  }

  async function sendQuote(row: (typeof eligible)[number]) {
    if (!orgId) return;
    setBusy(true);
    setError('');
    try {
      const item = (row.rfq.items || []).find((i) => i.listingId === row.listingId) || row.rfq.items?.[0];
      if (!item) throw new Error('RFQ item missing');
      const draft = await apiAuthed<{ id: string }>('/seller/quotes/draft', {
        method: 'POST',
        json: {
          sellerOrganizationId: orgId,
          rfqId: row.rfq.id,
          rfqTargetId: row.rfqTargetId,
          currency: 'USD',
          priceType: 'EXW',
          items: [
            {
              rfqItemId: item.id,
              listingId: row.listingId,
              quantity: Number(item.quantity),
              uomCode: item.uomCode,
              basePrice: Number(quoteBase) || 1,
              leadTimeDays: 7,
              titleSnapshot: item.titleSnapshot || row.listing?.title || 'Item',
            },
          ],
        },
      });
      await apiAuthed(`/seller/quotes/${draft.id}/submit`, { method: 'POST' });
      setMsg(copy.seller_quote_sent);
      await loadOrgData(orgId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  async function createOrg(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const org = await apiAuthed<Org>('/organizations', {
        method: 'POST',
        json: {
          name: orgName.trim(),
          slug: (orgSlug || slugify(orgName)).toLowerCase().replace(/[^a-z0-9-]/g, '-'),
          canSell: true,
          canBuy: true,
          isProfessional: asPro,
          primarySpecialty: asPro ? 'contracting' : undefined,
          location: {
            city: facCity.trim() || initialCity || 'Tehran',
            province: facProvince.trim() || undefined,
            countryCode: 'IR',
            line1: facLine1.trim() || facCity.trim() || 'Tehran',
            latitude: Number(facLat) || undefined,
            longitude: Number(facLng) || undefined,
          },
        },
      });
      setMsg(copy.seller_org_created);
      setOrgName('');
      setOrgSlug('');
      await refresh();
      setOrgId(org.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  async function createFacility(e: FormEvent) {
    e.preventDefault();
    if (!orgId) return;
    setBusy(true);
    setError('');
    try {
      await apiAuthed('/seller/facilities', {
        method: 'POST',
        json: {
          organizationId: orgId,
          name: facName.trim(),
          type: facType,
          status: 'ACTIVE',
          isPublicLocation: facPublic,
          address: {
            countryCode: 'IR',
            province: facProvince,
            city: facCity,
            line1: facLine1 || facCity,
          },
          geoPoint: {
            latitude: Number(facLat),
            longitude: Number(facLng),
          },
        },
      });
      setMsg(copy.seller_facility_created);
      setFacName('');
      await loadOrgData(orgId);
      setTab('listing');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  if (!user) {
    return <p className="pk-notice">{copy.panel_loading}</p>;
  }

  return (
    <div className="panel-workspace factory-workspace">
      <header className="panel-header">
        <div>
          <strong>{copy.seller_panel_title}</strong>
          <div className="panel-header__meta">
            {user.fullName || user.email} · {user.platformRole}
          </div>
        </div>
        <div className="panel-header__actions">
          <a className="btn ghost" href={`/${locale}/catalog`}>
            {copy.nav_catalog}
          </a>
          <button
            type="button"
            className="btn ghost"
            onClick={() => {
              void logout().then(() => router.push(`/${locale}/login`));
            }}
          >
            {copy.auth_logout}
          </button>
        </div>
      </header>

      <div className="panel-body">
        <nav className="panel-tabs">
          <button type="button" className={tab === 'overview' ? 'is-active' : ''} onClick={() => setTab('overview')}>
            {copy.seller_tab_org}
          </button>
          <button type="button" className={tab === 'facility' ? 'is-active' : ''} onClick={() => setTab('facility')}>
            {copy.seller_tab_facility}
          </button>
          <button type="button" className={tab === 'listing' ? 'is-active' : ''} onClick={() => setTab('listing')}>
            {copy.seller_tab_listing}
          </button>
          <button type="button" className={tab === 'commerce' ? 'is-active' : ''} onClick={() => setTab('commerce')}>
            {copy.seller_tab_commerce}
          </button>
        </nav>

        {error ? <p className="panel-err">{error}</p> : null}
        {msg ? <p className="panel-ok">{msg}</p> : null}

        {tab === 'overview' ? (
          <section className="panel-card">
            <h2>{copy.seller_orgs}</h2>
            {orgs.length ? (
              <label>
                {copy.seller_active_org}
                <select value={orgId} onChange={(e) => setOrgId(e.target.value)}>
                  {orgs.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name} ({o.slug})
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <p className="panel-muted">{copy.seller_no_org}</p>
            )}

            <h3>{copy.seller_create_org}</h3>
            <form className="panel-form" onSubmit={createOrg}>
              <label>
                {copy.seller_org_name}
                <input required value={orgName} onChange={(e) => setOrgName(e.target.value)} />
              </label>
              <label>
                {copy.seller_org_slug}
                <input
                  value={orgSlug}
                  onChange={(e) => setOrgSlug(e.target.value)}
                  placeholder={slugify(orgName) || 'my-factory'}
                />
              </label>
              <label className="panel-check">
                <input type="checkbox" checked={asPro} onChange={(e) => setAsPro(e.target.checked)} />
                {copy.seller_also_professional}
              </label>
              <button className="mp-btn mp-btn--primary" disabled={busy} type="submit">
                {copy.seller_create_org_cta}
              </button>
            </form>
          </section>
        ) : null}

        {tab === 'facility' ? (
          <section className="panel-card">
            <h2>{copy.seller_facilities}</h2>
            {!orgId ? <p className="panel-muted">{copy.seller_need_org}</p> : null}
            <ul className="panel-list">
              {facilities.map((f) => (
                <li key={f.id}>
                  <strong>{f.name}</strong> · {f.type} · {f.address?.city}
                  {f.address?.province ? `, ${f.address.province}` : ''} · {f.status}
                </li>
              ))}
            </ul>
            <h3>{copy.seller_add_facility}</h3>
            <form className="panel-form" onSubmit={createFacility}>
              <label>
                {copy.seller_facility_name}
                <input required value={facName} onChange={(e) => setFacName(e.target.value)} disabled={!orgId} />
              </label>
              <label>
                {copy.seller_facility_type}
                <select value={facType} onChange={(e) => setFacType(e.target.value)}>
                  {['FACTORY', 'WAREHOUSE', 'SHOWROOM', 'OFFICE', 'SERVICE_LOCATION'].map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <div className="panel-grid-2">
                <label>
                  {copy.seller_city}
                  <input required value={facCity} onChange={(e) => setFacCity(e.target.value)} />
                </label>
                <label>
                  {copy.seller_province}
                  <input value={facProvince} onChange={(e) => setFacProvince(e.target.value)} />
                </label>
              </div>
              <label>
                {copy.seller_address}
                <input value={facLine1} onChange={(e) => setFacLine1(e.target.value)} placeholder={copy.seller_address_ph} />
              </label>
              <div className="panel-grid-2">
                <label>
                  Lat
                  <input value={facLat} onChange={(e) => setFacLat(e.target.value)} />
                </label>
                <label>
                  Lng
                  <input value={facLng} onChange={(e) => setFacLng(e.target.value)} />
                </label>
              </div>
              <label className="panel-check">
                <input type="checkbox" checked={facPublic} onChange={(e) => setFacPublic(e.target.checked)} />
                {copy.seller_public_location}
              </label>
              <button className="mp-btn mp-btn--primary" disabled={busy || !orgId} type="submit">
                {copy.seller_add_facility_cta}
              </button>
            </form>
          </section>
        ) : null}

        {tab === 'listing' ? (
          <section className="panel-card">
            <h2>{copy.seller_listings}</h2>
            <ul className="panel-list">
              {listings.map((l) => (
                <li key={l.id}>
                  <strong>{l.title}</strong> · {l.status}
                  {l.price?.displayPrice != null ? ` · ${l.price.displayPrice} ${l.price.currency}` : ''}
                  {l.inventory ? (
                    <>
                      {' '}
                      · {copy.seller_stock_now}: {l.inventory.available ?? l.inventory.onHand ?? 0}{' '}
                      {l.inventory.uomCode || l.uomCode || ''}
                    </>
                  ) : null}
                  {l.rejectionReason ? ` · ${l.rejectionReason}` : ''}
                  {l.status === 'PUBLISHED' ? (
                    <>
                      {' '}
                      <a href={`/${locale}/catalog/${l.slug}`}>{copy.mp_view_listing}</a>
                    </>
                  ) : null}
                  <div className="designer-actions" style={{ marginTop: '0.45rem' }}>
                    <button
                      type="button"
                      className={mediaListingId === l.id ? 'mp-btn mp-btn--primary' : 'mp-btn'}
                      onClick={() => setMediaListingId(l.id)}
                    >
                      {copy.seller_manage_media}
                    </button>
                  </div>
                </li>
              ))}
            </ul>

            {mediaListingId ? (
              <div className="panel-card" style={{ marginTop: '1rem' }}>
                <h3>
                  {copy.seller_media_title} —{' '}
                  {listings.find((l) => l.id === mediaListingId)?.title || mediaListingId.slice(-6)}
                </h3>
                <div className="seller-media-grid">
                  {listingMedia.map((m) => (
                    <figure key={m.id} className="seller-media-item">
                      {m.url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={m.url} alt={m.altText || ''} />
                      ) : null}
                      <button type="button" className="mp-btn" disabled={busy} onClick={() => void removeListingPhoto(m.id)}>
                        {copy.seller_media_remove}
                      </button>
                    </figure>
                  ))}
                </div>
                {!listingMedia.length ? <p className="panel-muted">{copy.seller_media_empty}</p> : null}
                <label className="mp-btn" style={{ display: 'inline-block', cursor: 'pointer' }}>
                  {copy.seller_media_upload}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    hidden
                    disabled={busy}
                    onChange={(e) => {
                      const f = e.target.files?.[0] || null;
                      e.target.value = '';
                      void uploadListingPhoto(mediaListingId, f);
                    }}
                  />
                </label>

                <h3 style={{ marginTop: '1.25rem' }}>{copy.seller_stock_manage}</h3>
                <div className="panel-grid-3">
                  <label>
                    {copy.seller_stock_qty}
                    <input value={stockAdjust} onChange={(e) => setStockAdjust(e.target.value)} />
                  </label>
                  <button
                    type="button"
                    className="mp-btn mp-btn--primary"
                    disabled={busy}
                    onClick={() => void adjustStock(mediaListingId, 'in')}
                  >
                    {copy.seller_stock_in}
                  </button>
                  <button type="button" className="mp-btn" disabled={busy} onClick={() => void adjustStock(mediaListingId, 'out')}>
                    {copy.seller_stock_out}
                  </button>
                </div>
              </div>
            ) : null}

            <SellerListingWizard
              locale={locale}
              copy={copy}
              orgId={orgId}
              categories={categories}
              facilities={facilities}
              busy={busy}
              setBusy={setBusy}
              setError={setError}
              setMsg={setMsg}
              initialCategorySlug={initialCategorySlug}
              initialCity={initialCity}
              onCreated={(id) => {
                setMediaListingId(id);
                if (orgId) void loadOrgData(orgId);
              }}
            />
          </section>
        ) : null}

        {tab === 'commerce' ? (
          <section className="panel-card">
            <h2>{copy.seller_eligible_rfqs}</h2>
            <label>
              {copy.seller_quote_base}
              <input value={quoteBase} onChange={(e) => setQuoteBase(e.target.value)} />
            </label>
            <div className="panel-stack">
              {eligible.map((row) => (
                <article key={row.rfqTargetId} className="panel-item">
                  <h3>
                    {row.listing?.title || row.listingId} · {row.rfq.status}
                  </h3>
                  <p className="panel-muted">
                    {row.rfq.buyer?.name || 'Buyer'} ·{' '}
                    {(row.rfq.items || [])
                      .map((i) => `${i.quantity} ${i.uomCode}`)
                      .join(', ')}
                  </p>
                  <button
                    type="button"
                    className="mp-btn mp-btn--primary"
                    disabled={busy || !orgId}
                    onClick={() => void sendQuote(row)}
                  >
                    {copy.seller_send_quote}
                  </button>
                </article>
              ))}
            </div>
            {!eligible.length ? <p className="panel-muted">{copy.seller_no_eligible}</p> : null}

            <h2 style={{ marginTop: '1.25rem' }}>{copy.seller_orders}</h2>
            <ul className="panel-list">
              {sellerOrders.map((o) => (
                <li key={o.id}>
                  <strong>{o.status}</strong> · {o.buyer?.name || 'Buyer'} · {o.totalDisplayPrice} {o.currency}
                </li>
              ))}
            </ul>
            {!sellerOrders.length ? <p className="panel-muted">{copy.seller_no_orders}</p> : null}
          </section>
        ) : null}
      </div>
    </div>
  );
}
