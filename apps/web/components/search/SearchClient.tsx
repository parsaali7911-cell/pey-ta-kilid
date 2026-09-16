'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type {
  HomepageNaturalLanguageResponse,
  RankedRecommendation,
  SearchQuery,
} from '@peytakilid/shared-types';
import { apiPostClient, SEARCH_QUERY_STORAGE_KEY, SEARCH_TEXT_STORAGE_KEY } from '@/lib/api';
import { MarketplaceListingCard } from '@/components/home/marketplace/MarketplaceListingCard';
import { SiteSearchBar } from '@/components/search/SiteSearchBar';
import { isLocale, t, type Locale } from '@/lib/i18n-public';
import { loadVisualSearchPayload, type VisualSearchPayload } from '@/lib/visual-search';

export function SearchClient({
  locale,
  initialQuery,
  initialPhotoMode = false,
}: {
  locale: string;
  initialQuery?: string;
  initialPhotoMode?: boolean;
}) {
  const router = useRouter();
  const ui: Locale = isLocale(locale) ? locale : 'fa';
  const copy = t(ui);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hits, setHits] = useState<RankedRecommendation['hits']>([]);
  const [needText, setNeedText] = useState<string | null>(initialQuery || null);
  const [clarify, setClarify] = useState<HomepageNaturalLanguageResponse['intent']['clarification']>(null);
  const [photo, setPhoto] = useState<VisualSearchPayload | null>(null);
  const [intentNext, setIntentNext] = useState<string | null>(null);
  const [intentInfo, setIntentInfo] = useState<string | null>(null);
  const [extracted, setExtracted] = useState<Record<string, unknown> | null>(null);
  const [deepLink, setDeepLink] = useState<string | null>(null);

  useEffect(() => {
    if (initialPhotoMode) {
      const payload = loadVisualSearchPayload();
      if (!payload) {
        setError(copy.search_photo_expired);
        setPhoto(null);
        setHits([]);
        return;
      }
      setPhoto(payload);
      const caption =
        initialQuery?.trim() ||
        payload.caption ||
        payload.tone ||
        copy.search_photo_matched;
      setNeedText(caption);
      const city = payload.city;
      const bits = [copy.search_intent_product];
      if (city) bits.push(`${copy.seller_city}: ${city}`);
      if (payload.categorySlug) bits.push(payload.categorySlug);
      setIntentInfo(bits.join(' · '));
      setIntentNext('search');
      setExtracted({
        intent: 'PRODUCT',
        city: city || null,
        categorySlug: payload.categorySlug || null,
        caption: payload.caption || null,
        tone: payload.tone || null,
        hex: payload.hex || null,
      });
      setHits(
        payload.results
          .filter((r) => r.slug && r.title)
          .map((r) => ({
            listingId: r.listingId,
            score: r.score ?? 0,
            matchedAttributes: ['visual'],
            scoreComponents: [],
            preview: {
              slug: r.slug!,
              title: r.title!,
              displayPrice: r.displayPrice ?? null,
              currency: r.currency ?? null,
              uomCode: r.uomCode ?? null,
              category: r.category?.name
                ? { id: '', slug: '', name: r.category.name }
                : null,
              organizationPublic: r.organizationPublic?.name
                ? { id: '', name: r.organizationPublic.name, slug: '' }
                : null,
            },
          })),
      );
      return;
    }

    const q = initialQuery?.trim();
    if (!q) {
      const raw = sessionStorage.getItem(SEARCH_QUERY_STORAGE_KEY);
      const text = sessionStorage.getItem(SEARCH_TEXT_STORAGE_KEY);
      if (text) setNeedText(text);
      if (!raw) return;
      let query: SearchQuery;
      try {
        query = JSON.parse(raw) as SearchQuery;
      } catch {
        return;
      }
      void runSearch(query);
      return;
    }
    void runIntent(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery, initialPhotoMode, locale]);

  async function runIntent(text: string) {
    setBusy(true);
    setError(null);
    setClarify(null);
    setPhoto(null);
    setIntentNext(null);
    setIntentInfo(null);
    setExtracted(null);
    setNeedText(text);
    try {
      const data = await apiPostClient<HomepageNaturalLanguageResponse>('/intent/nl', {
        text,
        locale: ui,
        market: 'IRAN',
      });
      sessionStorage.setItem(SEARCH_TEXT_STORAGE_KEY, text);
      setIntentNext(data.next);
      setExtracted({
        intent: data.intent.intent,
        journey: data.intent.requirements.journey,
        confidence: data.intent.confidence,
        categoryHints: data.intent.requirements.categoryHints,
        categorySlugHints: data.intent.requirements.categorySlugHints,
        attributeFilters: data.intent.requirements.attributeFilters,
        quantity: data.intent.requirements.quantity,
        uomCode: data.intent.requirements.uomCode,
        specialtyHints: data.intent.requirements.specialtyHints,
        location: data.intent.requirements.location,
        missingFields: data.intent.requirements.missingFields,
      });

      const city = data.route?.city || data.intent.requirements.location?.city || '';
      const province =
        data.route?.province || data.intent.requirements.location?.province || '';
      const specialty =
        data.route?.specialty || data.intent.requirements.specialtyHints?.[0] || '';
      const categorySlug =
        data.route?.categorySlug || data.intent.requirements.categorySlugHints?.[0] || '';

      if (data.next === 'clarify') {
        setClarify(data.intent.clarification || null);
        setHits([]);
        setIntentInfo(copy.search_intent_clarify);
        return;
      }

      if (data.next === 'seller_onboard') {
        const qs = new URLSearchParams({ tab: 'listing', wizard: '1' });
        if (categorySlug) qs.set('category', categorySlug);
        if (city) qs.set('city', city);
        else if (province) qs.set('city', province);
        const href = `/${ui}/seller?${qs.toString()}`;
        setDeepLink(href);
        setIntentInfo(copy.search_intent_seller_onboard);
        setHits([]);
        router.push(href);
        return;
      }

      if (data.next === 'professional_onboard') {
        const qs = new URLSearchParams({ onboard: '1' });
        if (specialty) qs.set('specialty', specialty);
        if (city) qs.set('city', city);
        else if (province) qs.set('city', province);
        const href = `/${ui}/professionals?${qs.toString()}`;
        setDeepLink(href);
        setIntentInfo(copy.search_intent_pro_onboard);
        setHits([]);
        router.push(href);
        return;
      }

      if (data.next === 'professional_search' || data.next === 'professional_lead') {
        const qs = new URLSearchParams({ find: '1' });
        if (specialty) qs.set('specialty', specialty);
        if (city) qs.set('city', city);
        else if (province) qs.set('city', province);
        const href = `/${ui}/professionals?${qs.toString()}`;
        setDeepLink(href);
        setIntentInfo(
          data.next === 'professional_search'
            ? copy.search_intent_pro_search
            : copy.search_intent_professional,
        );
        setHits([]);
        router.push(href);
        return;
      }

      if (data.next === 'design_assist') {
        setIntentInfo(copy.search_intent_design);
        if (data.searchQuery) {
          sessionStorage.setItem(SEARCH_QUERY_STORAGE_KEY, JSON.stringify(data.searchQuery));
          await runSearch(data.searchQuery);
        }
        return;
      }
      if (data.searchQuery) {
        sessionStorage.setItem(SEARCH_QUERY_STORAGE_KEY, JSON.stringify(data.searchQuery));
        setIntentInfo(copy.search_intent_product);
        await runSearch(data.searchQuery);
      } else {
        setHits([]);
      }
    } catch {
      setError(copy.no_results);
    } finally {
      setBusy(false);
    }
  }

  async function runSearch(query: SearchQuery) {
    setBusy(true);
    setError(null);
    try {
      const data = await apiPostClient<RankedRecommendation>('/search', query);
      setHits(data.hits || []);
    } catch {
      setError(copy.no_results);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div style={{ padding: '1rem 1.25rem 0' }}>
        <SiteSearchBar locale={ui} copy={copy} variant="inline" showRecent initialQuery={initialQuery} />
      </div>

      {photo ? (
        <div className="search-photo-panel" style={{ margin: '0.85rem 1.25rem' }}>
          <div className="search-photo-result-head">
            {photo.previewDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="search-photo-preview" src={photo.previewDataUrl} alt="" />
            ) : null}
            <div>
              <p className="search-photo-panel__matched">{copy.search_photo_matched}</p>
              {photo.hex ? (
                <span>
                  <span className="search-photo-swatch" style={{ background: photo.hex }} />
                  <code>{photo.hex}</code>
                  {photo.tone ? <span className="search-photo-tone"> · {photo.tone}</span> : null}
                </span>
              ) : null}
            </div>
          </div>
          <p className="search-photo-panel__hint">{copy.search_photo_hint}</p>
        </div>
      ) : null}

      {needText && !photo ? <div className="pk-notice">{needText}</div> : null}
      {intentInfo ? <div className="pk-notice">{intentInfo}</div> : null}
      {extracted ? (
        <div className="pk-notice search-extract">
          <strong>{copy.search_extract_title}</strong>
          <pre style={{ margin: '0.5rem 0 0', whiteSpace: 'pre-wrap', fontSize: '0.82rem' }}>
            {JSON.stringify(extracted, null, 2)}
          </pre>
          {deepLink ? (
            <p style={{ marginTop: '0.75rem' }}>
              <a className="mp-btn mp-btn--primary" href={deepLink}>
                {copy.search_go_routed}
              </a>
            </p>
          ) : null}
          {intentNext === 'professional_lead' || intentNext === 'professional_search' ? (
            <p style={{ marginTop: '0.75rem' }}>
              <a className="mp-btn mp-btn--primary" href={deepLink || `/${ui}/professionals`}>
                {copy.search_go_professionals}
              </a>
            </p>
          ) : null}
          {intentNext === 'seller_onboard' ? (
            <p style={{ marginTop: '0.75rem' }}>
              <a className="mp-btn mp-btn--primary" href={deepLink || `/${ui}/seller?tab=listing&wizard=1`}>
                {copy.search_go_seller}
              </a>
            </p>
          ) : null}
          {intentNext === 'design_assist' ? (
            <p style={{ marginTop: '0.75rem' }}>
              <a className="mp-btn mp-btn--primary" href={`/${ui}/designer`}>
                {copy.search_go_designer}
              </a>
            </p>
          ) : null}
        </div>
      ) : null}
      {busy ? <div className="pk-notice">{copy.search_working}</div> : null}
      {error ? <div className="pk-notice">{error}</div> : null}

      {clarify?.fields?.length ? (
        <div className="pk-notice">
          <strong>{copy.clarifying}</strong>
          <ul>
            {clarify.fields.map((f) => (
              <li key={f.field}>
                {f.field}: {f.question}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {!busy && hits.length === 0 && (needText || photo) && !clarify ? (
        <div className="pk-empty">{copy.no_results}</div>
      ) : null}

      {hits.length > 0 ? (
        <div className="pk-catalog-grid">
          {hits.map((hit) => (
            <MarketplaceListingCard
              key={hit.listingId}
              locale={ui}
              copy={copy}
              listing={{
                slug: hit.preview.slug,
                title: hit.preview.title,
                categoryName: hit.preview.category?.name,
                sellerName: hit.preview.organizationPublic?.name,
                displayPrice: hit.preview.displayPrice,
                currency: hit.preview.currency,
                uomCode: hit.preview.uomCode,
              }}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
