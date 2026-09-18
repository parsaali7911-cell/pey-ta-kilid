'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
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
  address?: { city?: string; province?: string; line1?: string };
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

type Screen = 'compose' | 'details';

function catLabel(c: WizardCategory, locale: Locale) {
  if (locale === 'fa') return c.nameFa || c.name || c.nameEn || c.slug;
  if (locale === 'ar') return c.nameFa || c.name || c.nameEn || c.slug;
  return c.nameEn || c.name || c.nameFa || c.slug;
}

function attrLabel(d: AttrDef, locale: Locale) {
  if (locale === 'fa' || locale === 'ar') return d.nameFa || d.nameEn || d.code;
  return d.nameEn || d.nameFa || d.code;
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
    list.sort((a, b) => catLabel(a, 'fa').localeCompare(catLabel(b, 'fa'), 'fa'));
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
 * Divar-style post-ad flow:
 * 1) photos + title + description
 * 2) category → location → features (attrs) → price (تومان) → submit
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
  autoOpen = false,
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
  autoOpen?: boolean;
}) {
  const [open, setOpen] = useState(Boolean(autoOpen || initialCategorySlug));
  const [screen, setScreen] = useState<Screen>('compose');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [browseParentId, setBrowseParentId] = useState<string | null>(null);
  const [catQuery, setCatQuery] = useState('');
  const [catPickerOpen, setCatPickerOpen] = useState(false);
  const [facilityId, setFacilityId] = useState(facilities[0]?.id || '');
  const [cityFallback, setCityFallback] = useState(initialCity || '');
  const [attrDefs, setAttrDefs] = useState<AttrDef[]>([]);
  const [attrValues, setAttrValues] = useState<Record<string, string>>({});
  const [priceToman, setPriceToman] = useState('');
  const [stockQty, setStockQty] = useState('');
  const [showMore, setShowMore] = useState(false);
  const [moq, setMoq] = useState('1');
  const [leadDays, setLeadDays] = useState('7');
  const [uomCode, setUomCode] = useState('m2');
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

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
      .slice(0, 16);
  }, [catQuery, categories, childrenMap, locale]);

  useEffect(() => {
    if (facilities[0]?.id && !facilityId) setFacilityId(facilities[0].id);
  }, [facilities, facilityId]);

  useEffect(() => {
    if (!initialCategorySlug || !categories.length) return;
    const hit = categories.find((c) => c.slug === initialCategorySlug);
    if (!hit) return;
    setOpen(true);
    setCategoryId(hit.id);
    setBrowseParentId(hit.parentId ?? null);
    if (!(buildChildrenMap(categories).get(hit.id) || []).length) {
      setScreen('details');
    }
  }, [initialCategorySlug, categories]);

  useEffect(() => {
    return () => {
      for (const url of previews) URL.revokeObjectURL(url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!categoryId || !isLeaf) {
      setAttrDefs([]);
      setAttrValues({});
      return;
    }
    const selected = categories.find((c) => c.id === categoryId);
    setUomCode(selected?.defaultUomCode || 'm2');

    void fetch(apiUrl(`/categories/${categoryId}/attributes`))
      .then((r) => r.json())
      .then((defs) => {
        const list = Array.isArray(defs) ? (defs as AttrDef[]) : [];
        setAttrDefs(list);
        const next: Record<string, string> = {};
        for (const d of list) {
          if (d.dataType === 'ENUM' && Array.isArray(d.enumOptions) && d.enumOptions[0]) {
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

  function addFiles(files: File[]) {
    const next = [...pendingFiles, ...files].slice(0, 8);
    setPendingFiles(next);
    setPreviews((prev) => {
      for (const u of prev) URL.revokeObjectURL(u);
      return next.map((f) => URL.createObjectURL(f));
    });
  }

  function removeFile(index: number) {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => {
      const url = prev[index];
      if (url) URL.revokeObjectURL(url);
      return prev.filter((_, i) => i !== index);
    });
  }

  function selectCategory(id: string) {
    setCategoryId(id);
    const kids = childrenMap.get(id) || [];
    if (kids.length) {
      setBrowseParentId(id);
      return;
    }
    setCatPickerOpen(false);
    setCatQuery('');
  }

  function goToDetails() {
    setError('');
    if (!pendingFiles.length) {
      setError(copy.divar_need_photo || 'حداقل یک عکس از آگهی لازم است');
      return;
    }
    if (!title.trim() || title.trim().length < 3) {
      setError(copy.divar_need_title || 'عنوان آگهی را بنویسید');
      return;
    }
    setScreen('details');
  }

  async function submitAll(e?: FormEvent) {
    e?.preventDefault();
    if (!orgId) return;
    setError('');
    if (!categoryId || !isLeaf) {
      setError(copy.seller_wizard_pick_leaf);
      setCatPickerOpen(true);
      return;
    }
    if (!facilityId && !cityFallback.trim()) {
      setError(copy.divar_need_location || 'موقعیت آگهی را مشخص کنید');
      return;
    }
    for (const d of attrDefs) {
      if (d.required && !(attrValues[d.code] || '').trim()) {
        setError(`${copy.seller_wizard_need_attr}: ${attrLabel(d, locale)}`);
        return;
      }
    }
    const priceNum = Number(String(priceToman).replace(/,/g, ''));
    if (!(priceNum >= 0) || String(priceToman).trim() === '') {
      setError(copy.divar_need_price || 'قیمت را به تومان وارد کنید');
      return;
    }

    setBusy(true);
    try {
      const attributes = attrDefs
        .map((d) => {
          const raw = (attrValues[d.code] || '').trim();
          if (!raw && !d.required) return null;
          if (d.dataType === 'NUMBER') return { attributeCode: d.code, valueNumber: Number(raw) };
          if (d.dataType === 'BOOLEAN') {
            return { attributeCode: d.code, valueBoolean: raw === 'true' || raw === '1' };
          }
          return { attributeCode: d.code, valueString: raw || '—' };
        })
        .filter(Boolean);

      const locNote =
        !facilityId && cityFallback.trim()
          ? `${copy.divar_location || 'موقعیت'}: ${cityFallback.trim()}`
          : '';

      const listing = await apiAuthed<{ id: string; slug: string }>('/seller/listings', {
        method: 'POST',
        json: {
          organizationId: orgId,
          categoryId,
          facilityId: facilityId || undefined,
          title: title.trim(),
          description: [description.trim(), locNote].filter(Boolean).join('\n\n') || undefined,
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
          supplierCost: priceNum,
          currency: 'IRR',
          priceType: 'EXW',
        },
      });

      const stock = Number(stockQty);
      if (stock > 0) {
        await apiAuthed(`/seller/listings/${listing.id}/inventory/in`, {
          method: 'POST',
          json: { quantity: stock, note: 'Initial stock' },
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
      setOpen(false);
      setScreen('compose');
      setPendingFiles([]);
      setPreviews((prev) => {
        for (const u of prev) URL.revokeObjectURL(u);
        return [];
      });
      setTitle('');
      setDescription('');
      setCategoryId('');
      setBrowseParentId(null);
      setPriceToman('');
      setStockQty('');
      setAttrDefs([]);
      setAttrValues({});
      onCreated(listing.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <div className="divar-post-launch">
        <button
          type="button"
          className="mp-btn mp-btn--primary mp-btn--block divar-post-launch__btn"
          disabled={!orgId}
          onClick={() => {
            setOpen(true);
            setScreen('compose');
            setError('');
          }}
        >
          {copy.divar_post_ad || copy.seller_new_listing || 'ثبت آگهی'}
        </button>
        <p className="panel-muted">{copy.divar_post_hint || 'مثل دیوار: عکس، توضیحات، بعد دسته و قیمت.'}</p>
      </div>
    );
  }

  const categorySummary = selectedPath.length
    ? selectedPath.map((p) => catLabel(p, locale)).join(' › ')
    : copy.divar_pick_category || 'انتخاب دسته';

  const facilitySummary = facilityId
    ? (() => {
        const f = facilities.find((x) => x.id === facilityId);
        if (!f) return copy.divar_pick_location || 'انتخاب موقعیت';
        return [f.name, f.address?.city, f.address?.province].filter(Boolean).join(' — ');
      })()
    : cityFallback.trim() || copy.divar_pick_location || 'انتخاب موقعیت';

  return (
    <div className="divar-post" dir={locale === 'en' ? 'ltr' : 'rtl'}>
      <header className="divar-post__head">
        <button
          type="button"
          className="divar-post__back"
          onClick={() => {
            setError('');
            if (screen === 'details') {
              setScreen('compose');
              return;
            }
            setOpen(false);
          }}
          disabled={busy}
        >
          {copy.seller_wizard_back || 'بازگشت'}
        </button>
        <strong>{copy.divar_post_ad || 'ثبت آگهی'}</strong>
        <span className="divar-post__step">
          {screen === 'compose' ? '۱ / ۲' : '۲ / ۲'}
        </span>
      </header>

      {screen === 'compose' ? (
        <div className="divar-post__body">
          <section className="divar-post__section">
            <h3>{copy.divar_photos || 'عکس آگهی'}</h3>
            <p className="panel-muted">{copy.divar_photos_hint || 'اولین عکس، تصویر اصلی آگهی می‌شود.'}</p>
            <div className="divar-post__photos">
              {previews.map((src, i) => (
                <figure key={src} className={`divar-post__photo${i === 0 ? ' is-cover' : ''}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" />
                  {i === 0 ? <span className="divar-post__cover-badge">{copy.divar_cover || 'عکس اصلی'}</span> : null}
                  <button type="button" className="divar-post__photo-x" onClick={() => removeFile(i)} aria-label="remove">
                    ×
                  </button>
                </figure>
              ))}
              {pendingFiles.length < 8 ? (
                <button type="button" className="divar-post__photo-add" onClick={() => galleryRef.current?.click()}>
                  <span>+</span>
                  <em>{copy.divar_add_photo || 'افزودن عکس'}</em>
                </button>
              ) : null}
            </div>
            <div className="divar-post__photo-actions">
              <button type="button" className="mp-btn" onClick={() => galleryRef.current?.click()}>
                {copy.designer_from_gallery || 'گالری'}
              </button>
              <button type="button" className="mp-btn" onClick={() => cameraRef.current?.click()}>
                {copy.designer_from_camera || 'دوربین'}
              </button>
            </div>
            <input
              ref={galleryRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/*"
              multiple
              hidden
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                e.target.value = '';
                if (files.length) addFiles(files);
              }}
            />
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              hidden
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                e.target.value = '';
                if (files.length) addFiles(files);
              }}
            />
          </section>

          <section className="divar-post__section">
            <label className="divar-post__field">
              <span>{copy.divar_title || 'عنوان آگهی'}</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={copy.divar_title_ph || 'مثلاً سرامیک کف ۸۰×۸۰ پرسلان'}
                maxLength={80}
              />
            </label>
            <label className="divar-post__field">
              <span>{copy.divar_desc || 'توضیحات آگهی'}</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                placeholder={
                  copy.divar_desc_ph || 'جزئیات کالا، وضعیت، شرایط فروش و هر نکته‌ای که خریدار باید بداند…'
                }
              />
            </label>
          </section>

          <div className="divar-post__sticky">
            <button type="button" className="mp-btn mp-btn--primary mp-btn--block" disabled={busy || !orgId} onClick={goToDetails}>
              {copy.seller_wizard_next || 'بعدی'}
            </button>
          </div>
        </div>
      ) : null}

      {screen === 'details' ? (
        <form className="divar-post__body" onSubmit={(e) => void submitAll(e)}>
          <section className="divar-post__section">
            <h3>{copy.divar_category || 'دسته‌بندی'}</h3>
            <button
              type="button"
              className="divar-post__row"
              onClick={() => setCatPickerOpen((v) => !v)}
            >
              <span>{copy.divar_category || 'دسته'}</span>
              <strong>{categorySummary}</strong>
            </button>

            {catPickerOpen ? (
              <div className="divar-post__picker">
                <input
                  className="divar-post__search"
                  value={catQuery}
                  onChange={(e) => setCatQuery(e.target.value)}
                  placeholder={copy.seller_wizard_cat_search_ph}
                />
                {catQuery.trim() ? (
                  <ul className="divar-post__list">
                    {searchHits.map((c) => (
                      <li key={c.id}>
                        <button type="button" onClick={() => selectCategory(c.id)}>
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
                    <div className="divar-post__crumbs">
                      <button type="button" onClick={() => setBrowseParentId(null)}>
                        {copy.seller_wizard_browse_root}
                      </button>
                      {browsePath.map((p) => (
                        <button key={p.id} type="button" onClick={() => setBrowseParentId(p.id)}>
                          {catLabel(p, locale)}
                        </button>
                      ))}
                    </div>
                    <ul className="divar-post__list">
                      {browseChildren.map((c) => {
                        const hasKids = (childrenMap.get(c.id) || []).length > 0;
                        return (
                          <li key={c.id}>
                            <button
                              type="button"
                              className={categoryId === c.id ? 'is-active' : undefined}
                              onClick={() => selectCategory(c.id)}
                            >
                              <span>{catLabel(c, locale)}</span>
                              <em>{hasKids ? '‹' : '✓'}</em>
                            </button>
                          </li>
                        );
                      })}
                      {!browseChildren.length ? <li className="panel-muted">{copy.seller_wizard_cat_empty}</li> : null}
                    </ul>
                  </>
                )}
              </div>
            ) : null}
          </section>

          <section className="divar-post__section">
            <h3>{copy.divar_location || 'موقعیت مکانی آگهی'}</h3>
            {facilities.length ? (
              <label className="divar-post__field">
                <span>{copy.divar_location || 'مکان آگهی'}</span>
                <select value={facilityId} onChange={(e) => setFacilityId(e.target.value)}>
                  <option value="">{copy.seller_no_facility}</option>
                  {facilities.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                      {f.address?.city ? ` — ${f.address.city}` : ''}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className="divar-post__field">
              <span>{copy.divar_city || 'شهر / محله'}</span>
              <input
                value={cityFallback}
                onChange={(e) => setCityFallback(e.target.value)}
                placeholder={copy.divar_city_ph || 'مثلاً کرج، مهرشهر'}
              />
            </label>
            <p className="panel-muted">{facilitySummary}</p>
          </section>

          <section className="divar-post__section">
            <h3>{copy.divar_features || 'ویژگی‌ها'}</h3>
            {attrDefs.length ? (
              <div className="divar-post__attrs">
                {attrDefs.map((d) => (
                  <label key={d.id} className="divar-post__field">
                    <span>
                      {attrLabel(d, locale)}
                      {d.required ? ' *' : ''}
                      {d.unit ? ` (${d.unit})` : ''}
                    </span>
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
                    ) : d.dataType === 'BOOLEAN' ? (
                      <select
                        value={attrValues[d.code] || ''}
                        onChange={(e) => setAttrValues((s) => ({ ...s, [d.code]: e.target.value }))}
                      >
                        <option value="">—</option>
                        <option value="true">{copy.yes || 'بله'}</option>
                        <option value="false">{copy.no || 'خیر'}</option>
                      </select>
                    ) : (
                      <input
                        required={Boolean(d.required)}
                        inputMode={d.dataType === 'NUMBER' ? 'decimal' : 'text'}
                        value={attrValues[d.code] || ''}
                        onChange={(e) => setAttrValues((s) => ({ ...s, [d.code]: e.target.value }))}
                      />
                    )}
                  </label>
                ))}
              </div>
            ) : (
              <p className="panel-muted">
                {isLeaf
                  ? copy.seller_wizard_no_attrs
                  : copy.divar_pick_category_first || 'اول دسته را کامل انتخاب کنید تا ویژگی‌ها بیاید.'}
              </p>
            )}

            <label className="divar-post__field divar-post__price">
              <span>{copy.divar_price || 'قیمت (تومان)'}</span>
              <div className="divar-post__price-row">
                <input
                  inputMode="numeric"
                  value={priceToman}
                  onChange={(e) => setPriceToman(e.target.value.replace(/[^\d]/g, ''))}
                  placeholder="۰"
                  required
                />
                <em>{copy.divar_toman || 'تومان'}</em>
              </div>
            </label>

            <label className="divar-post__field">
              <span>{copy.divar_stock || 'موجودی (اختیاری)'}</span>
              <input
                inputMode="decimal"
                value={stockQty}
                onChange={(e) => setStockQty(e.target.value)}
                placeholder={uomCode ? `${copy.seller_stock || 'موجودی'} · ${uomCode}` : ''}
              />
            </label>

            <button type="button" className="divar-post__more" onClick={() => setShowMore((v) => !v)}>
              {showMore
                ? copy.divar_hide_more || 'بستن ویژگی‌های خاص'
                : copy.divar_show_more || 'ویژگی‌های خاص'}
            </button>
            {showMore ? (
              <div className="divar-post__attrs">
                <label className="divar-post__field">
                  <span>{copy.seller_wizard_uom}</span>
                  <input value={uomCode} readOnly disabled />
                </label>
                <label className="divar-post__field">
                  <span>MOQ</span>
                  <input value={moq} onChange={(e) => setMoq(e.target.value)} />
                </label>
                <label className="divar-post__field">
                  <span>{copy.listing_lead}</span>
                  <input value={leadDays} onChange={(e) => setLeadDays(e.target.value)} />
                </label>
              </div>
            ) : null}
          </section>

          <div className="divar-post__sticky">
            <button type="submit" className="mp-btn mp-btn--primary mp-btn--block" disabled={busy || !orgId}>
              {busy ? copy.panel_loading || '…' : copy.divar_submit || copy.seller_submit_listing || 'ثبت آگهی'}
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
