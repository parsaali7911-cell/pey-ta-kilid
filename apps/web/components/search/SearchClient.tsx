'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type {
  HomepageNaturalLanguageResponse,
  RankedRecommendation,
  SearchQuery,
} from '@peytakilid/shared-types';
import { apiPostClient, apiUrl, SEARCH_QUERY_STORAGE_KEY, SEARCH_TEXT_STORAGE_KEY } from '@/lib/api';
import { MarketplaceListingCard } from '@/components/home/marketplace/MarketplaceListingCard';
import { SiteSearchBar } from '@/components/search/SiteSearchBar';
import { isLocale, t, type Locale } from '@/lib/i18n-public';
import { loadVisualSearchPayload, type VisualSearchPayload } from '@/lib/visual-search';

type ProOrg = {
  id: string;
  name: string;
  specialty?: string | null;
  specialtyLabel?: string | null;
  distanceKm?: number | null;
  locations?: Array<{ city?: string; province?: string }>;
};

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
  const [summary, setSummary] = useState<string | null>(null);
  const [preferCheapest, setPreferCheapest] = useState(false);
  const [deepLink, setDeepLink] = useState<string | null>(null);
  const [pros, setPros] = useState<ProOrg[]>([]);

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
      setSummary(bits.join(' · '));
      setIntentNext('search');
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
      if (city) void loadPros(city, undefined);
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

  async function loadPros(city?: string, specialty?: string) {
    try {
      const qs = new URLSearchParams({ locale: ui });
      if (city) qs.set('city', city);
      if (specialty) qs.set('specialty', specialty);
      const dir = await fetch(apiUrl(`/professionals/directory?${qs.toString()}`)).then((r) =>
        r.json(),
      );
      setPros(Array.isArray(dir) ? dir.slice(0, 4) : []);
    } catch {
      setPros([]);
    }
  }

  async function runIntent(text: string) {
    setBusy(true);
    setError(null);
    setClarify(null);
    setPhoto(null);
    setIntentNext(null);
    setIntentInfo(null);
    setSummary(null);
    setPreferCheapest(false);
    setDeepLink(null);
    setPros([]);
    setNeedText(text);
    try {
      const data = await apiPostClient<HomepageNaturalLanguageResponse>('/intent/nl', {
        text,
        locale: ui,
        market: 'IRAN',
      });
      sessionStorage.setItem(SEARCH_TEXT_STORAGE_KEY, text);
      setIntentNext(data.next);
      setPreferCheapest(Boolean(data.intent.requirements.preferCheapest));

      const city = data.route?.city || data.intent.requirements.location?.city || '';
      const province =
        data.route?.province || data.intent.requirements.location?.province || '';
      const specialty =
        data.route?.specialty || data.intent.requirements.specialtyHints?.[0] || '';
      const categorySlug =
        data.route?.categorySlug || data.intent.requirements.categorySlugHints?.[0] || '';
      const categoryHint = data.intent.requirements.categoryHints?.[0] || categorySlug;

      const parts: string[] = [];
      if (data.next === 'search' || data.next === 'design_assist') {
        parts.push(copy.search_ai_product);
        if (categoryHint) parts.push(categoryHint);
        if (city) parts.push(city);
        if (data.intent.requirements.preferCheapest) parts.push(copy.search_ai_cheapest);
      } else if (data.next === 'professional_search' || data.next === 'professional_lead') {
        parts.push(copy.search_ai_pro);
        if (specialty) parts.push(specialty);
        if (city) parts.push(city);
      } else if (data.next === 'seller_onboard') {
        parts.push(copy.search_ai_seller);
        if (categorySlug) parts.push(categorySlug);
      } else if (data.next === 'professional_onboard') {
        parts.push(copy.search_ai_pro_onboard);
      }
      setSummary(parts.filter(Boolean).join(' · ') || copy.search_ai_understood);

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
        await loadPros(city || province, specialty);
        return;
      }

      if (data.next === 'design_assist') {
        setIntentInfo(copy.search_intent_design);
        const designHref = `/${ui}/designer`;
        setDeepLink(designHref);
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
        if (city) await loadPros(city, specialty || undefined);
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
      setPreferCheapest(Boolean(query.filters?.preferCheapest || query.requirements?.preferCheapest));
    } catch {
      setError(copy.no_results);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="search-hub">
      <div className="search-hub__bar">
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
        </div>
      ) : null}

      {(summary || intentInfo || needText) && !photo ? (
        <div className="search-ai-card">
          <p className="search-ai-card__kicker">{copy.search_ai_kicker}</p>
          {needText ? <p className="search-ai-card__need">«{needText}»</p> : null}
          {summary ? <p className="search-ai-card__summary">{summary}</p> : null}
          {intentInfo ? <p className="search-ai-card__info">{intentInfo}</p> : null}
          {preferCheapest ? <p className="search-ai-card__badge">{copy.search_cheapest_badge}</p> : null}
          <p className="search-ai-card__pricing">{copy.mp_pricing_note}</p>
          {deepLink ? (
            <p style={{ marginTop: '0.75rem' }}>
              <a className="mp-btn mp-btn--primary" href={deepLink}>
                {intentNext === 'design_assist' ? copy.search_go_designer : copy.search_go_routed}
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

      {!busy && hits.length === 0 && (needText || photo) && !clarify && intentNext === 'search' ? (
        <div className="pk-empty">{copy.no_results}</div>
      ) : null}

      {hits.length > 0 ? (
        <section className="search-hub__results" aria-label={copy.search_title}>
          <h2 className="search-hub__results-title">
            {preferCheapest ? copy.search_cheapest_title : copy.search_results_title}
          </h2>
          <div className="pk-catalog-grid">
            {hits.map((hit, idx) => (
              <MarketplaceListingCard
                key={hit.listingId}
                locale={ui}
                copy={copy}
                badge={preferCheapest && idx < 3 ? copy.search_best_price_badge : undefined}
                listing={{
                  slug: hit.preview.slug,
                  title: hit.preview.title,
                  categoryName: hit.preview.category?.name,
                  sellerName: hit.preview.organizationPublic?.name,
                  displayPrice: hit.preview.displayPrice,
                  currency: hit.preview.currency,
                  uomCode: hit.preview.uomCode,
                  city: hit.preview.facilityPublic?.city,
                  imageUrl: hit.preview.imageUrl,
                }}
              />
            ))}
          </div>
        </section>
      ) : null}

      {pros.length > 0 ? (
        <section className="search-pro-rec" aria-labelledby="search-pro-title">
          <h2 id="search-pro-title" className="search-pro-rec__title">
            {copy.search_pro_rec_title}
          </h2>
          <p className="search-pro-rec__lead">{copy.search_pro_rec_lead}</p>
          <ul className="search-pro-rec__list">
            {pros.map((p) => (
              <li key={p.id}>
                <strong>{p.name}</strong>
                {p.specialtyLabel ? <span> · {p.specialtyLabel}</span> : null}
                {p.locations?.[0]?.city ? <span> · {p.locations[0].city}</span> : null}
                {p.distanceKm != null ? (
                  <span className="panel-muted"> · {p.distanceKm.toFixed(0)} km</span>
                ) : null}
                <span className="search-pro-rec__tag">{copy.search_pro_rec_tag}</span>
              </li>
            ))}
          </ul>
          <a className="mp-btn" href={`/${ui}/professionals?find=1`}>
            {copy.search_go_professionals}
          </a>
        </section>
      ) : null}
    </div>
  );
}
