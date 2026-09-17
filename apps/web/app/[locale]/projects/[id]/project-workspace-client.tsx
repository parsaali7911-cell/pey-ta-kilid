'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiAuthed, getAccessToken } from '@/lib/auth-client';
import type { Locale } from '@/lib/i18n-public';

type Requirement = {
  id: string;
  kind: 'PRODUCT' | 'SERVICE';
  title: string;
  stageCode?: string | null;
  stageLabel?: string | null;
  quantity?: number | null;
  uomCode?: string | null;
  specialtyCode?: string | null;
  category?: { id: string; slug: string; name: string } | null;
  status: string;
  needByDate?: string | null;
  procurementTargetDate?: string | null;
  recommendedRfqDate?: string | null;
  verifiedLeadTimeDays?: number | null;
  leadTimeVerified?: boolean;
  leadTimeSource?: string;
  listing?: { id: string; slug: string; title: string; leadTimeDays?: number | null } | null;
  rfq?: { id: string; publicId: string; status: string } | null;
  quote?: { id: string; publicId: string; status: string } | null;
  order?: { id: string; publicId: string; status: string } | null;
  professionalLead?: { id: string; publicId: string; status: string } | null;
};

type Workspace = {
  id: string;
  name: string;
  projectTypeCode?: string | null;
  areaM2?: number | null;
  status: string;
  progressPct: number;
  currentStageCode?: string | null;
  currentStageLabel?: string | null;
  estimatedCompletionDate?: string | null;
  location?: { city?: string; province?: string | null } | null;
  stages: Array<{
    stageCode: string;
    label: string;
    status: string;
    progressPct: number;
    categorySlugHints: string[];
    specialtyCodes: string[];
  }>;
  requirements: Requirement[];
  upcomingNeeds: Requirement[];
  procurement: {
    rfqs: Array<{ id: string; publicId: string; status: string }>;
    leads: Array<{ id: string; publicId: string; status: string; specialtyHints: string[] }>;
    openRequirementCount: number;
  };
};

export default function ProjectWorkspaceClient({
  locale,
  projectId,
  copy,
}: {
  locale: Locale;
  projectId: string;
  copy: Record<string, string>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [ws, setWs] = useState<Workspace | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [reqTitle, setReqTitle] = useState('');
  const [reqKind, setReqKind] = useState<'PRODUCT' | 'SERVICE'>('PRODUCT');
  const [reqQty, setReqQty] = useState('');
  const [reqUom, setReqUom] = useState('m2');
  const [reqSpecialty, setReqSpecialty] = useState('tile_installation');

  const load = useCallback(async () => {
    if (!getAccessToken()) return;
    const data = await apiAuthed<Workspace>(`/projects/${projectId}?locale=${locale}`);
    setWs(data);
  }, [projectId, locale]);

  useEffect(() => {
    if (!getAccessToken()) {
      router.push(`/${locale}/login?next=${encodeURIComponent(`/${locale}/projects/${projectId}`)}`);
      return;
    }
    void load().catch((e) => setError(e instanceof Error ? e.message : 'Failed'));
  }, [load, locale, projectId, router]);

  // Deep-link return: ?linkListing=&requirementId=
  useEffect(() => {
    const listingId = searchParams.get('linkListing');
    const requirementId = searchParams.get('requirementId');
    if (!listingId || !requirementId || !getAccessToken()) return;
    void (async () => {
      try {
        await apiAuthed(`/projects/${projectId}/requirements/${requirementId}/link-listing`, {
          method: 'POST',
          json: { listingId },
        });
        router.replace(`/${locale}/projects/${projectId}`);
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Link failed');
      }
    })();
  }, [searchParams, projectId, locale, load, router]);

  async function setStage(stageCode: string) {
    setBusy(true);
    try {
      const data = await apiAuthed<Workspace>(`/projects/${projectId}/current-stage?locale=${locale}`, {
        method: 'POST',
        json: { stageCode },
      });
      setWs(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  async function markDone(stageCode: string) {
    setBusy(true);
    try {
      const data = await apiAuthed<Workspace>(
        `/projects/${projectId}/stages/${stageCode}?locale=${locale}`,
        { method: 'PATCH', json: { status: 'DONE', progressPct: 100 } },
      );
      setWs(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  async function seedSuggestions() {
    if (!ws?.currentStageCode) return;
    setBusy(true);
    try {
      const res = await apiAuthed<{ workspace: Workspace }>(
        `/projects/${projectId}/stages/${ws.currentStageCode}/seed-suggestions?locale=${locale}`,
        { method: 'POST' },
      );
      setWs(res.workspace);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  async function addRequirement(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await apiAuthed<{ workspace: Workspace }>(
        `/projects/${projectId}/requirements?locale=${locale}`,
        {
          method: 'POST',
          json: {
            title: reqTitle.trim(),
            kind: reqKind,
            stageCode: ws?.currentStageCode || undefined,
            quantity: reqKind === 'PRODUCT' && reqQty ? Number(reqQty) : undefined,
            uomCode: reqKind === 'PRODUCT' ? reqUom : undefined,
            specialtyCode: reqKind === 'SERVICE' ? reqSpecialty : undefined,
          },
        },
      );
      setWs(res.workspace);
      setReqTitle('');
      setReqQty('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  async function syncCommerce() {
    setBusy(true);
    try {
      const data = await apiAuthed<Workspace>(`/projects/${projectId}/sync-commerce?locale=${locale}`, {
        method: 'POST',
      });
      setWs(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  function findProducts(r: Requirement) {
    const q = new URLSearchParams();
    q.set('q', r.title);
    if (r.category?.slug) q.set('category', r.category.slug);
    if (ws?.location?.city) q.set('city', ws.location.city);
    q.set('projectId', projectId);
    q.set('requirementId', r.id);
    router.push(`/${locale}/search?${q.toString()}`);
  }

  function findProfessionals(r: Requirement) {
    const q = new URLSearchParams();
    q.set('find', '1');
    if (r.specialtyCode) q.set('specialty', r.specialtyCode);
    if (ws?.location?.city) q.set('city', ws.location.city);
    q.set('projectId', projectId);
    q.set('requirementId', r.id);
    router.push(`/${locale}/professionals?${q.toString()}`);
  }

  async function requestQuote(r: Requirement) {
    if (!r.listing?.id) {
      findProducts(r);
      return;
    }
    setBusy(true);
    try {
      const orgs = await apiAuthed<Array<{ organization: { id: string; canBuy?: boolean } }>>(
        '/organizations',
      );
      const buyer = (orgs || []).find((o) => o.organization.canBuy !== false)?.organization.id;
      if (!buyer) throw new Error('Buyer org required');
      const draft = await apiAuthed<{ id: string }>('/buyer/rfqs/draft', {
        method: 'POST',
        json: {
          buyerOrganizationId: buyer,
          selectedListingIds: [r.listing.id],
          projectId,
          projectRequirementId: r.id,
          requirements: {
            intent: 'PRODUCT',
            locale,
            quantity: r.quantity || 1,
            uomCode: r.uomCode || 'm2',
            categoryHints: r.category?.slug ? [r.category.slug] : [],
            location: ws?.location?.city ? { city: ws.location.city, countryCode: 'IR' } : null,
            rawText: r.title,
          },
        },
      });
      await apiAuthed(`/buyer/rfqs/${draft.id}/submit`, { method: 'POST' });
      await load();
      router.push(`/${locale}/buyer?tab=rfqs&highlight=${draft.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'RFQ failed');
    } finally {
      setBusy(false);
    }
  }

  if (!ws && !error) return <p className="pk-notice">{copy.panel_loading}</p>;
  if (!ws) return <p className="panel-err">{error}</p>;

  const current = ws.stages.find((s) => s.stageCode === ws.currentStageCode);

  return (
    <div className="panel-workspace" style={{ padding: '1rem 0 2rem' }}>
      <header className="panel-header" style={{ marginBottom: '1rem' }}>
        <div className="panel-header__brand">
          <p className="panel-muted" style={{ margin: 0 }}>
            <a href={`/${locale}/projects`}>{copy.nav_projects}</a>
          </p>
          <h1>{ws.name}</h1>
          <p>
            {[
              ws.projectTypeCode,
              ws.location?.city,
              ws.areaM2 != null ? `${ws.areaM2} m²` : null,
              ws.currentStageLabel,
              `${ws.progressPct}%`,
              ws.status,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        <div className="panel-header__actions">
          <button type="button" className="mp-btn" disabled={busy} onClick={() => void syncCommerce()}>
            {copy.proj_sync_commerce}
          </button>
        </div>
      </header>

      {error ? <p className="panel-err">{error}</p> : null}

      <div className="panel-grid-2" style={{ gap: '1rem', alignItems: 'start' }}>
        <section className="panel-card">
          <h2>{copy.proj_current_stage}</h2>
          {current ? (
            <p>
              <strong>{current.label}</strong> · {current.status} · {current.progressPct}%
            </p>
          ) : (
            <p className="panel-muted">{copy.proj_no_stage}</p>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.75rem' }}>
            {ws.stages.map((s) => (
              <button
                key={s.stageCode}
                type="button"
                className={`mp-btn${s.stageCode === ws.currentStageCode ? ' mp-btn--primary' : ''}`}
                disabled={busy}
                onClick={() => void setStage(s.stageCode)}
              >
                {s.label}
                {s.status === 'DONE' ? ' ✓' : ''}
              </button>
            ))}
          </div>
          {current ? (
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
              <button type="button" className="mp-btn" disabled={busy} onClick={() => void markDone(current.stageCode)}>
                {copy.proj_mark_stage_done}
              </button>
              <button type="button" className="mp-btn" disabled={busy} onClick={() => void seedSuggestions()}>
                {copy.proj_seed_suggestions}
              </button>
            </div>
          ) : null}
        </section>

        <section className="panel-card">
          <h2>{copy.proj_add_requirement}</h2>
          <form className="panel-form" onSubmit={addRequirement}>
            <label>
              {copy.proj_req_kind}
              <select value={reqKind} onChange={(e) => setReqKind(e.target.value as 'PRODUCT' | 'SERVICE')}>
                <option value="PRODUCT">{copy.proj_kind_product}</option>
                <option value="SERVICE">{copy.proj_kind_service}</option>
              </select>
            </label>
            <label>
              {copy.proj_req_title}
              <input value={reqTitle} onChange={(e) => setReqTitle(e.target.value)} required minLength={2} />
            </label>
            {reqKind === 'PRODUCT' ? (
              <>
                <label>
                  {copy.proj_req_qty}
                  <input type="number" min={0} value={reqQty} onChange={(e) => setReqQty(e.target.value)} />
                </label>
                <label>
                  {copy.proj_req_uom}
                  <input value={reqUom} onChange={(e) => setReqUom(e.target.value)} />
                </label>
              </>
            ) : (
              <label>
                {copy.proj_req_specialty}
                <input value={reqSpecialty} onChange={(e) => setReqSpecialty(e.target.value)} />
              </label>
            )}
            <button className="mp-btn mp-btn--primary" type="submit" disabled={busy}>
              {copy.proj_req_add}
            </button>
          </form>
        </section>
      </div>

      <section className="panel-card" style={{ marginTop: '1rem' }}>
        <h2>
          {copy.proj_upcoming_needs} ({ws.upcomingNeeds.length})
        </h2>
        <ul className="panel-list">
          {ws.upcomingNeeds.map((r) => (
            <li key={r.id}>
              <strong>
                {r.title}
                {r.quantity != null ? ` · ${r.quantity} ${r.uomCode || ''}` : ''}
              </strong>
              <div className="panel-muted">
                {[r.kind, r.stageLabel, r.status].filter(Boolean).join(' · ')}
                {r.verifiedLeadTimeDays != null
                  ? ` · LT ${r.verifiedLeadTimeDays}d (${r.leadTimeVerified ? copy.proj_verified : copy.proj_planned})`
                  : ''}
                {r.recommendedRfqDate
                  ? ` · RFQ≤ ${new Date(r.recommendedRfqDate).toLocaleDateString(locale)}`
                  : ''}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.45rem' }}>
                {r.kind === 'PRODUCT' ? (
                  <>
                    <button type="button" className="mp-btn" onClick={() => findProducts(r)}>
                      {copy.proj_find_products}
                    </button>
                    <button type="button" className="mp-btn mp-btn--primary" disabled={busy} onClick={() => void requestQuote(r)}>
                      {copy.proj_request_quote}
                    </button>
                  </>
                ) : (
                  <button type="button" className="mp-btn mp-btn--primary" onClick={() => findProfessionals(r)}>
                    {copy.proj_find_pro}
                  </button>
                )}
                {r.rfq ? (
                  <a className="mp-btn" href={`/${locale}/buyer?tab=rfqs&highlight=${r.rfq.id}`}>
                    {copy.proj_view_rfq} ({r.rfq.status})
                  </a>
                ) : null}
                {r.quote ? (
                  <a className="mp-btn" href={`/${locale}/buyer?tab=quotes&highlight=${r.quote.id}`}>
                    {copy.proj_view_quote} ({r.quote.status})
                  </a>
                ) : null}
                {r.order ? (
                  <a className="mp-btn" href={`/${locale}/buyer?tab=orders&highlight=${r.order.id}`}>
                    {copy.proj_view_order} ({r.order.status})
                  </a>
                ) : null}
                {r.listing ? (
                  <a className="mp-btn" href={`/${locale}/catalog/${r.listing.slug}`}>
                    {r.listing.title}
                  </a>
                ) : null}
              </div>
            </li>
          ))}
          {!ws.upcomingNeeds.length ? <li className="panel-muted">{copy.proj_no_needs}</li> : null}
        </ul>
      </section>

      <div className="panel-grid-2" style={{ gap: '1rem', marginTop: '1rem' }}>
        <section className="panel-card">
          <h2>{copy.proj_procurement_status}</h2>
          <ul className="panel-list">
            {ws.procurement.rfqs.map((r) => (
              <li key={r.id}>
                <a href={`/${locale}/buyer?tab=rfqs&highlight=${r.id}`}>
                  RFQ {r.publicId.slice(0, 8)} · {r.status}
                </a>
              </li>
            ))}
            {!ws.procurement.rfqs.length ? <li className="panel-muted">{copy.proj_no_rfqs}</li> : null}
          </ul>
        </section>
        <section className="panel-card">
          <h2>{copy.proj_professionals}</h2>
          <ul className="panel-list">
            {ws.procurement.leads.map((l) => (
              <li key={l.id}>
                Lead {l.publicId.slice(0, 8)} · {l.status}
                {l.specialtyHints?.length ? ` · ${l.specialtyHints.join(', ')}` : ''}
              </li>
            ))}
            {!ws.procurement.leads.length ? <li className="panel-muted">{copy.proj_no_leads}</li> : null}
          </ul>
        </section>
      </div>

      <section className="panel-card" style={{ marginTop: '1rem' }}>
        <h2>{copy.proj_timeline}</h2>
        <ol className="panel-steps">
          {ws.stages.map((s) => (
            <li key={s.stageCode}>
              <strong>{s.label}</strong> — {s.status} ({s.progressPct}%)
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
