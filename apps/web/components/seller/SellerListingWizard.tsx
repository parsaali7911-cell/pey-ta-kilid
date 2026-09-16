'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { apiAuthed, apiAuthedForm } from '@/lib/auth-client';
import { apiUrl } from '@/lib/api';
import type { Locale } from '@/lib/i18n-public';

export type WizardCategory = {
  id: string;
  parentId?: string | null;
  slug: string;
  name?: string;
  nameEn?: string;
  nameFa?: string;
  defaultUomCode?: string | null;
};

export type WizardFacility = {
  id: string;
  name: string;
  address?: { city?: string };
};

type AttrDef = {
  id: string;
  code: string;
  dataType: string;
  required?: boolean;
  nameEn?: string;
  nameFa?: string;
  unit?: string | null;
  enumOptions?: string[] | null;
};

type Step = 'category' | 'identity' | 'details' | 'offer' | 'images' | 'review';

const STEPS: Step[] = ['category', 'identity', 'details', 'offer', 'images', 'review'];

function catLabel(c: WizardCategory, locale: Locale) {
  if (locale === 'fa') return c.nameFa || c.name || c.nameEn || c.slug;
  return c.nameEn || c.name || c.nameFa || c.slug;
}

function buildChildrenMap(cats: WizardCategory[]) {
  const byParent = new Map<string | null, WizardCategory[]>();
  for (const c of cats) {
    const key = c.parentId ?? null;
    const list = byParent.get(key) || [];
    list.push(c);
    byParent.set(key, list);
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => catLabel(a, 'en').localeCompare(catLabel(b, 'en')));
  }
  return byParent;
}

function pathFor(cats: WizardCategory[], id: string): WizardCategory[] {
  const byId = new Map(cats.map((c) => [c.id, c]));
  const path: WizardCategory[] = [];
  let cur: WizardCategory | undefined = byId.get(id);
  while (cur) {
    path.unshift(cur);
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
  }
  return path;
}

function slugify(input: string) {
  const ascii = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  return ascii || 'listing';
}

/**
 * Amazon-inspired listing wizard for factories:
 * search/browse category → product identity → category attributes → offer → images → submit.
 * Uses Peytakilid taxonomy/APIs (not Amazon content).
 */
export function SellerListingWizard({
  locale,
  copy,
  orgId,
  categories,
  facilities,
  busy,
  setBusy,
  setError,
  setMsg,
  onCreated,
  initialCategorySlug,
  initialCity,
}: {
  locale: Locale;
  copy: Record<string, string>;
  orgId: string;
  categories: WizardCategory[];
  facilities: WizardFacility[];
  busy: boolean;
  setBusy: (v: boolean) => void;
  setError: (v: string) => void;
  setMsg: (v: string) => void;
  onCreated: (listingId: string) => void;
  initialCategorySlug?: string;
  initialCity?: string;
}) {
  const [step, setStep] = useState<Step>('category');
  const [catQuery, setCatQuery] = useState('');
  const [browseParentId, setBrowseParentId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState('');
  const [title, setTitle] = useState('');
  const [brand, setBrand] = useState('');
  const [description, setDescription] = useState('');
  const [bullets, setBullets] = useState('');
  const [attrDefs, setAttrDefs] = useState<AttrDef[]>([]);
  const [attrValues, setAttrValues] = useState<Record<string, string>>({});
  const [facilityId, setFacilityId] = useState(facilities[0]?.id || '');
  const [uomCode, setUomCode] = useState('m2');
  const [moq, setMoq] = useState('1');
  const [leadDays, setLeadDays] = useState('7');
  const [supplierCost, setSupplierCost] = useState('10');
  const [currency, setCurrency] = useState('USD');
  const [stockQty, setStockQty] = useState('100');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [routedNote, setRoutedNote] = useState('');

  const childrenMap = useMemo(() => buildChildrenMap(categories), [categories]);
  const selectedPath = useMemo(
    () => (categoryId ? pathFor(categories, categoryId) : []),
    [categories, categoryId],
  );
  const browsePath = useMemo(
    () => (browseParentId ? pathFor(categories, browseParentId) : []),
    [categories, browseParentId],
  );
  const browseChildren = childrenMap.get(browseParentId) || [];
  const isLeaf = categoryId ? !(childrenMap.get(categoryId) || []).length : false;

  const searchHits = useMemo(() => {
    const q = catQuery.trim().toLowerCase();
    if (!q) return [];
    return categories
      .filter((c) => {
        const label = catLabel(c, locale).toLowerCase();
        return label.includes(q) || c.slug.includes(q);
      })
      .filter((c) => !(childrenMap.get(c.id) || []).length)
      .slice(0, 12);
  }, [catQuery, categories, childrenMap, locale]);

  useEffect(() => {
    if (facilities[0]?.id && !facilityId) setFacilityId(facilities[0].id);
  }, [facilities, facilityId]);

  useEffect(() => {
    if (!initialCategorySlug || !categories.length) return;
    const hit = categories.find((c) => c.slug === initialCategorySlug);
    if (!hit) return;
    setCategoryId(hit.id);
    setBrowseParentId(hit.parentId ?? null);
    const kids = (buildChildrenMap(categories).get(hit.id) || []).length;
    if (!kids) {
      setStep('identity');
      setRoutedNote(
        `${copy.seller_wizard_selected}: ${pathFor(categories, hit.id).map((p) => catLabel(p, locale)).join(' › ')}${
          initialCity ? ` · ${initialCity}` : ''
        }`,
      );
    }
  }, [initialCategorySlug, initialCity, categories, copy.seller_wizard_selected, locale]);

  useEffect(() => {
    if (!categoryId || !isLeaf) {
      setAttrDefs([]);
      setAttrValues({});
      return;
    }
    const selected = categories.find((c) => c.id === categoryId);
    const lockedUom = selected?.defaultUomCode || 'm2';
    setUomCode(lockedUom);

    void fetch(apiUrl(`/categories/${categoryId}/attributes`))
      .then((r) => r.json())
      .then((defs) => {
        const list = Array.isArray(defs) ? (defs as AttrDef[]) : [];
        setAttrDefs(list);
        const next: Record<string, string> = {};
        for (const d of list) {
          if (d.code === 'size_cm') next[d.code] = '60';
          else if (d.dataType === 'ENUM' && Array.isArray(d.enumOptions) && d.enumOptions[0]) {
            next[d.code] = String(d.enumOptions[0]);
          } else next[d.code] = '';
        }
        setAttrValues(next);
      })
      .catch(() => {
        setAttrDefs([]);
        setAttrValues({});
      });
  }, [categoryId, isLeaf, categories]);

  function stepIndex(s: Step) {
    return STEPS.indexOf(s);
  }

  function goNext() {
    setError('');
    if (step === 'category') {
      if (!categoryId || !isLeaf) {
        setError(copy.seller_wizard_pick_leaf);
        return;
      }
      setStep('identity');
      return;
    }
    if (step === 'identity') {
      if (!title.trim()) {
        setError(copy.seller_wizard_need_title);
        return;
      }
      setStep('details');
      return;
    }
    if (step === 'details') {
      for (const d of attrDefs) {
        if (d.required && !(attrValues[d.code] || '').trim()) {
          setError(`${copy.seller_wizard_need_attr}: ${d.nameFa || d.nameEn || d.code}`);
          return;
        }
      }
      setStep('offer');
      return;
    }
    if (step === 'offer') {
      if (!(Number(supplierCost) >= 0) || !(Number(stockQty) >= 0)) {
        setError(copy.seller_wizard_need_offer);
        return;
      }
      setStep('images');
      return;
    }
    if (step === 'images') {
      setStep('review');
    }
  }

  function goBack() {
    const i = stepIndex(step);
    if (i > 0) setStep(STEPS[i - 1]);
  }

  function selectCategory(id: string) {
    setCategoryId(id);
    const kids = childrenMap.get(id) || [];
    if (kids.length) {
      setBrowseParentId(id);
    }
  }

  async function submitAll(e: FormEvent) {
    e.preventDefault();
    if (!orgId || !categoryId) return;
    setBusy(true);
    setError('');
    try {
      const attributes = attrDefs
        .map((d) => {
          const raw = (attrValues[d.code] || '').trim();
          if (!raw && !d.required) return null;
          if (d.dataType === 'NUMBER') return { attributeCode: d.code, valueNumber: Number(raw) };
          if (d.dataType === 'BOOLEAN') {
            return { attributeCode: d.code, valueBoolean: raw === 'true' || raw === '1' };
          }
          return { attributeCode: d.code, valueString: raw || brand || '—' };
        })
        .filter(Boolean);

      const fullDescription = [
        description.trim(),
        brand.trim() ? `${copy.seller_wizard_brand}: ${brand.trim()}` : '',
        bullets
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean)
          .map((l) => `• ${l}`)
          .join('\n'),
      ]
        .filter(Boolean)
        .join('\n\n');

      const listing = await apiAuthed<{ id: string; slug: string }>('/seller/listings', {
        method: 'POST',
        json: {
          organizationId: orgId,
          categoryId,
          facilityId: facilityId || undefined,
          title: title.trim(),
          description: fullDescription || undefined,
          slug: `${slugify(title) || 'listing'}-${Date.now().toString(36).slice(-4)}`,
          uomCode: uomCode || 'm2',
          moq: Number(moq) || 1,
          leadTimeDays: Number(leadDays) || 7,
          attributes,
        },
      });

      await apiAuthed(`/seller/listings/${listing.id}/price`, {
        method: 'POST',
        json: {
          supplierCost: Number(supplierCost) || 0,
          currency,
          priceType: 'EXW',
        },
      });

      if (Number(stockQty) > 0) {
        await apiAuthed(`/seller/listings/${listing.id}/inventory/in`, {
          method: 'POST',
          json: { quantity: Number(stockQty), note: 'Initial stock' },
        });
      }

      for (const file of pendingFiles.slice(0, 8)) {
        const form = new FormData();
        form.append('file', file);
        form.append('altText', title.trim() || file.name);
        await apiAuthedForm(`/seller/listings/${listing.id}/media`, form);
      }

      const submitted = await apiAuthed<{ status: string }>(`/seller/listings/${listing.id}/submit`, {
        method: 'POST',
      });
      setMsg(`${copy.seller_listing_submitted}: ${submitted.status}`);
      setStep('category');
      setCategoryId('');
      setBrowseParentId(null);
      setTitle('');
      setBrand('');
      setDescription('');
      setBullets('');
      setPendingFiles([]);
      onCreated(listing.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="seller-wizard">
      <h3>{copy.seller_new_listing}</h3>
      <p className="panel-muted">{copy.seller_wizard_lead}</p>
      {routedNote ? <p className="panel-ok">{routedNote}</p> : null}

      <ol className="seller-wizard__steps" aria-label={copy.seller_wizard_steps}>
        {STEPS.map((s) => (
          <li key={s} className={step === s ? 'is-active' : stepIndex(s) < stepIndex(step) ? 'is-done' : ''}>
            {copy[`seller_wizard_step_${s}`] || s}
          </li>
        ))}
      </ol>

      {step === 'category' ? (
        <div className="seller-wizard__panel">
          <label>
            {copy.seller_wizard_cat_search}
            <input
              value={catQuery}
              onChange={(e) => setCatQuery(e.target.value)}
              placeholder={copy.seller_wizard_cat_search_ph}
              disabled={!orgId}
            />
          </label>

          {catQuery.trim() ? (
            <ul className="panel-list">
              {searchHits.map((c) => (
                <li key={c.id}>
                  <button type="button" className="mp-btn" onClick={() => selectCategory(c.id)}>
                    {pathFor(categories, c.id)
                      .map((p) => catLabel(p, locale))
                      .join(' › ')}
                  </button>
                </li>
              ))}
              {!searchHits.length ? <li className="panel-muted">{copy.seller_wizard_cat_empty}</li> : null}
            </ul>
          ) : (
            <>
              <div className="seller-wizard__crumbs">
                <button type="button" className="mp-btn" onClick={() => setBrowseParentId(null)}>
                  {copy.seller_wizard_browse_root}
                </button>
                {browsePath.map((p) => (
                  <button key={p.id} type="button" className="mp-btn" onClick={() => setBrowseParentId(p.id)}>
                    {catLabel(p, locale)}
                  </button>
                ))}
              </div>
              <div className="seller-wizard__browse">
                {browseChildren.map((c) => {
                  const hasKids = (childrenMap.get(c.id) || []).length > 0;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      className={`seller-wizard__cat ${categoryId === c.id ? 'is-selected' : ''}`}
                      onClick={() => selectCategory(c.id)}
                    >
                      <strong>{catLabel(c, locale)}</strong>
                      <span>{hasKids ? copy.seller_wizard_has_children : copy.seller_wizard_leaf}</span>
                    </button>
                  );
                })}
                {!browseChildren.length ? <p className="panel-muted">{copy.seller_wizard_cat_empty}</p> : null}
              </div>
            </>
          )}

          {selectedPath.length ? (
            <p className="panel-ok">
              {copy.seller_wizard_selected}: {selectedPath.map((p) => catLabel(p, locale)).join(' › ')}
              {!isLeaf ? ` — ${copy.seller_wizard_pick_leaf}` : ''}
            </p>
          ) : null}
        </div>
      ) : null}

      {step === 'identity' ? (
        <div className="seller-wizard__panel panel-form">
          <p className="panel-muted">
            {copy.seller_wizard_selected}: {selectedPath.map((p) => catLabel(p, locale)).join(' › ')}
          </p>
          <label>
            {copy.seller_listing_title} *
            <input required value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label>
            {copy.seller_wizard_brand}
            <input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder={copy.seller_wizard_brand_ph} />
          </label>
          <label>
            {copy.seller_listing_desc}
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </label>
          <label>
            {copy.seller_wizard_bullets}
            <textarea
              value={bullets}
              onChange={(e) => setBullets(e.target.value)}
              rows={4}
              placeholder={copy.seller_wizard_bullets_ph}
            />
          </label>
        </div>
      ) : null}

      {step === 'details' ? (
        <div className="seller-wizard__panel">
          <p className="panel-muted">{copy.seller_wizard_details_lead}</p>
          {attrDefs.length ? (
            <div className="panel-grid-2 panel-form">
              {attrDefs.map((d) => (
                <label key={d.id}>
                  {(locale === 'fa' ? d.nameFa || d.nameEn : d.nameEn || d.nameFa) || d.code}
                  {d.required ? ' *' : ''}
                  {d.unit ? ` (${d.unit})` : ''}
                  {d.dataType === 'ENUM' && Array.isArray(d.enumOptions) ? (
                    <select
                      required={Boolean(d.required)}
                      value={attrValues[d.code] || ''}
                      onChange={(e) => setAttrValues((s) => ({ ...s, [d.code]: e.target.value }))}
                    >
                      <option value="">—</option>
                      {d.enumOptions.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      required={Boolean(d.required)}
                      value={attrValues[d.code] || ''}
                      onChange={(e) => setAttrValues((s) => ({ ...s, [d.code]: e.target.value }))}
                    />
                  )}
                </label>
              ))}
            </div>
          ) : (
            <p className="panel-muted">{copy.seller_wizard_no_attrs}</p>
          )}
        </div>
      ) : null}

      {step === 'offer' ? (
        <div className="seller-wizard__panel panel-form">
          <label>
            {copy.seller_facility_link}
            <select value={facilityId} onChange={(e) => setFacilityId(e.target.value)}>
              <option value="">{copy.seller_no_facility}</option>
              {facilities.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name} — {f.address?.city}
                </option>
              ))}
            </select>
          </label>
          <div className="panel-grid-3">
            <label>
              {copy.seller_wizard_uom}
              <input value={uomCode} readOnly disabled title={copy.seller_wizard_uom_locked} />
              <span className="panel-muted" style={{ fontSize: '0.85em' }}>
                {copy.seller_wizard_uom_locked}
              </span>
            </label>
            <label>
              MOQ
              <input value={moq} onChange={(e) => setMoq(e.target.value)} />
            </label>
            <label>
              {copy.listing_lead}
              <input value={leadDays} onChange={(e) => setLeadDays(e.target.value)} />
            </label>
          </div>
          <div className="panel-grid-3">
            <label>
              {copy.seller_supplier_cost}
              <input value={supplierCost} onChange={(e) => setSupplierCost(e.target.value)} />
            </label>
            <label>
              {copy.seller_currency}
              <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                {['USD', 'IRR', 'EUR', 'AED'].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {copy.seller_stock}
              <input value={stockQty} onChange={(e) => setStockQty(e.target.value)} />
            </label>
          </div>
        </div>
      ) : null}

      {step === 'images' ? (
        <div className="seller-wizard__panel">
          <p className="panel-muted">{copy.seller_wizard_images_lead}</p>
          <label className="mp-btn" style={{ display: 'inline-block', cursor: 'pointer' }}>
            {copy.seller_media_upload}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              hidden
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                e.target.value = '';
                setPendingFiles((prev) => [...prev, ...files].slice(0, 8));
              }}
            />
          </label>
          <ul className="panel-list">
            {pendingFiles.map((f, i) => (
              <li key={`${f.name}-${i}`}>
                {f.name} · {Math.round(f.size / 1024)} KB
                <button
                  type="button"
                  className="mp-btn"
                  style={{ marginInlineStart: 8 }}
                  onClick={() => setPendingFiles((prev) => prev.filter((_, idx) => idx !== i))}
                >
                  {copy.seller_media_remove}
                </button>
              </li>
            ))}
          </ul>
          {!pendingFiles.length ? <p className="panel-muted">{copy.seller_media_empty}</p> : null}
        </div>
      ) : null}

      {step === 'review' ? (
        <form className="seller-wizard__panel" onSubmit={submitAll}>
          <ul className="panel-list">
            <li>
              <strong>{copy.seller_category}:</strong>{' '}
              {selectedPath.map((p) => catLabel(p, locale)).join(' › ')}
            </li>
            <li>
              <strong>{copy.seller_listing_title}:</strong> {title}
            </li>
            <li>
              <strong>{copy.seller_wizard_brand}:</strong> {brand || '—'}
            </li>
            <li>
              <strong>{copy.seller_stock}:</strong> {stockQty} {uomCode} · {supplierCost} {currency}
            </li>
            <li>
              <strong>{copy.seller_media_title}:</strong> {pendingFiles.length}
            </li>
            <li>
              <strong>{copy.seller_wizard_step_details}:</strong>{' '}
              {attrDefs.map((d) => `${d.code}=${attrValues[d.code] || '—'}`).join(' · ') || '—'}
            </li>
          </ul>
          <button className="mp-btn mp-btn--primary" type="submit" disabled={busy || !orgId}>
            {copy.seller_submit_listing}
          </button>
        </form>
      ) : null}

      {step !== 'review' ? (
        <div className="designer-actions" style={{ marginTop: '1rem' }}>
          {stepIndex(step) > 0 ? (
            <button type="button" className="mp-btn" onClick={goBack} disabled={busy}>
              {copy.seller_wizard_back}
            </button>
          ) : null}
          <button type="button" className="mp-btn mp-btn--primary" onClick={goNext} disabled={busy || !orgId}>
            {copy.seller_wizard_next}
          </button>
        </div>
      ) : (
        <div className="designer-actions" style={{ marginTop: '0.75rem' }}>
          <button type="button" className="mp-btn" onClick={goBack} disabled={busy}>
            {copy.seller_wizard_back}
          </button>
        </div>
      )}
    </div>
  );
}
