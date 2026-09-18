'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { apiAuthed, apiAuthedForm } from '@/lib/auth-client';
import { apiUrl } from '@/lib/api';
import type { Locale } from '@/lib/i18n-public';
import { LocationMapPicker, type MapLocationValue } from '@/components/LocationMapPicker';

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

type Screen = 1 | 2 | 3;

function catLabel(c: WizardCategory, locale: Locale) {
  if (locale === 'fa' || locale === 'ar') return c.nameFa || c.name || c.nameEn || c.slug;
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

function formatTomanWords(n: number, locale: Locale): string {
  if (!Number.isFinite(n) || n <= 0) return '';
  if (locale !== 'fa') return `${n.toLocaleString('en-US')} Toman`;
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(n % 1_000_000_000 ? 1 : 0)} میلیارد تومان`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0)} میلیون تومان`;
  if (n >= 1_000) return `${Math.round(n / 1_000)} هزار تومان`;
  return `${n} تومان`;
}

function formatGrouped(raw: string) {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Divar-style 3-page post-ad flow (photos → category/location/features → price).
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
  const [screen, setScreen] = useState<Screen>(1);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [browseParentId, setBrowseParentId] = useState<string | null>(null);
  const [catQuery, setCatQuery] = useState('');
  const [sheet, setSheet] = useState<'category' | 'location' | 'attr' | null>(null);
  const [activeAttr, setActiveAttr] = useState<AttrDef | null>(null);
  const [mapLoc, setMapLoc] = useState<MapLocationValue | null>(
    initialCity ? { latitude: 35.6892, longitude: 51.389, city: initialCity, label: initialCity } : null,
  );
  const [facilityId, setFacilityId] = useState(facilities[0]?.id || '');
  const [attrDefs, setAttrDefs] = useState<AttrDef[]>([]);
  const [attrValues, setAttrValues] = useState<Record<string, string>>({});
  const [priceToman, setPriceToman] = useState('');
  const [priceFixed, setPriceFixed] = useState(false);
  const [wantTrade, setWantTrade] = useState(false);
  const [stockQty, setStockQty] = useState('');
  const [uomCode, setUomCode] = useState('m2');
  const galleryRef = useRef<HTMLInputElement>(null);

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
      .slice(0, 20);
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
        for (const d of list) next[d.code] = '';
        setAttrValues(next);
      })
      .catch(() => {
        setAttrDefs([]);
        setAttrValues({});
      });
  }, [categoryId, isLeaf, categories]);

  function resetAll() {
    setScreen(1);
    setPendingFiles([]);
    setPreviews((prev) => {
      for (const u of prev) URL.revokeObjectURL(u);
      return [];
    });
    setTitle('');
    setDescription('');
    setCategoryId('');
    setBrowseParentId(null);
    setCatQuery('');
    setSheet(null);
    setMapLoc(initialCity ? { latitude: 35.6892, longitude: 51.389, city: initialCity, label: initialCity } : null);
    setAttrDefs([]);
    setAttrValues({});
    setPriceToman('');
    setPriceFixed(false);
    setWantTrade(false);
    setStockQty('');
    setError('');
  }

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
    setSheet(null);
    setCatQuery('');
  }

  function goNext() {
    setError('');
    if (screen === 1) {
      if (!pendingFiles.length) {
        setError(copy.divar_need_photo || 'حداقل یک عکس لازم است');
        return;
      }
      if (title.trim().length < 2) {
        setError(copy.divar_need_title || 'عنوان آگهی را بنویسید');
        return;
      }
      if (description.trim().length < 2) {
        setError(copy.divar_need_desc || 'توضیحات آگهی را بنویسید');
        return;
      }
      setScreen(2);
      return;
    }
    if (screen === 2) {
      if (!categoryId || !isLeaf) {
        setError(copy.seller_wizard_pick_leaf);
        setSheet('category');
        return;
      }
      if (!mapLoc && !facilityId) {
        setError(copy.divar_need_location || 'مکان آگهی را مشخص کنید');
        setSheet('location');
        return;
      }
      for (const d of attrDefs.slice(0, 2)) {
        if (d.required && !(attrValues[d.code] || '').trim()) {
          setError(`${copy.seller_wizard_need_attr}: ${attrLabel(d, locale)}`);
          return;
        }
      }
      setScreen(3);
    }
  }

  function goBack() {
    setError('');
    if (sheet) {
      setSheet(null);
      setActiveAttr(null);
      return;
    }
    if (screen > 1) {
      setScreen((s) => (s === 3 ? 2 : 1));
      return;
    }
    setOpen(false);
  }

  async function submitAll(e?: FormEvent) {
    e?.preventDefault();
    if (!orgId) return;
    setError('');
    if (!categoryId || !isLeaf) {
      setError(copy.seller_wizard_pick_leaf);
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

      const extras = [
        priceFixed ? copy.divar_price_fixed || 'قیمت مقطوع است' : '',
        wantTrade ? copy.divar_want_trade || 'مایلم معاوضه کنم' : '',
        mapLoc?.label ? `${copy.divar_location || 'مکان'}: ${mapLoc.label}` : '',
      ]
        .filter(Boolean)
        .join('\n');

      const listing = await apiAuthed<{ id: string; slug: string }>('/seller/listings', {
        method: 'POST',
        json: {
          organizationId: orgId,
          categoryId,
          facilityId: facilityId || undefined,
          title: title.trim(),
          description: [description.trim(), extras].filter(Boolean).join('\n\n') || undefined,
          slug: `${slugify(title) || 'listing'}-${Date.now().toString(36).slice(-4)}`,
          uomCode: uomCode || 'm2',
          moq: 1,
          leadTimeDays: 7,
          attributes,
        },
      });

      await apiAuthed(`/seller/listings/${listing.id}/price`, {
        method: 'POST',
        json: { supplierCost: priceNum, currency: 'IRR', priceType: 'EXW' },
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
      resetAll();
      setOpen(false);
      onCreated(listing.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  const categorySummary = selectedPath.length
    ? selectedPath.map((p) => catLabel(p, locale)).join(' › ')
    : '';
  const locationSummary =
    mapLoc?.label ||
    (facilityId
      ? (() => {
          const f = facilities.find((x) => x.id === facilityId);
          return f ? [f.address?.city, f.name].filter(Boolean).join('، ') : '';
        })()
      : '');

  const priceNum = Number(String(priceToman).replace(/,/g, '')) || 0;
  const stepLabel =
    screen === 1
      ? copy.divar_page_1 || 'صفحه ۱ از ۳: تصاویر و توضیحات'
      : screen === 2
        ? copy.divar_page_2 || 'صفحه ۲ از ۳: دسته و ویژگی‌ها'
        : copy.divar_page_3 || 'صفحه ۳ از ۳: قیمت و ثبت';

  if (!open) {
    return (
      <div className="dv-launch">
        <button
          type="button"
          className="dv-btn dv-btn--block"
          disabled={!orgId}
          onClick={() => {
            resetAll();
            setOpen(true);
            setError('');
          }}
        >
          {copy.divar_post_ad || 'ثبت آگهی'}
        </button>
      </div>
    );
  }

  return (
    <div className="dv-post" dir={locale === 'en' ? 'ltr' : 'rtl'}>
      <header className="dv-post__head">
        <button type="button" className="dv-post__clear" onClick={resetAll} disabled={busy}>
          {copy.divar_clear || 'پاک کردن'}
        </button>
        <strong>{copy.divar_post_ad || 'ثبت آگهی'}</strong>
        <button type="button" className="dv-post__icon-back" onClick={goBack} disabled={busy} aria-label="back">
          ‹
        </button>
      </header>

      <div className="dv-post__progress" aria-hidden>
        <span className={screen === 1 ? 'is-on' : screen > 1 ? 'is-done' : ''} />
        <span className={screen === 2 ? 'is-on' : screen > 2 ? 'is-done' : ''} />
        <span className={screen === 3 ? 'is-on' : ''} />
      </div>
      <p className="dv-post__step">{stepLabel}</p>

      {screen === 1 ? (
        <div className="dv-post__body">
          <label className="dv-label">
            {copy.divar_photos || 'عکس آگهی'} <i>*</i>
          </label>
          <div className="dv-photos">
            {pendingFiles.length < 8 ? (
              <button type="button" className="dv-photos__add" onClick={() => galleryRef.current?.click()}>
                <span className="dv-photos__cam" aria-hidden />
                <em>{copy.divar_add_photo || 'افزودن عکس'}</em>
              </button>
            ) : null}
            {previews.map((src, i) => (
              <figure key={src} className="dv-photos__item">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" />
                {i === 0 ? <span>{copy.divar_cover || 'عکس اصلی'}</span> : null}
                <button type="button" className="dv-photos__x" onClick={() => removeFile(i)}>
                  ×
                </button>
              </figure>
            ))}
          </div>
          <input
            ref={galleryRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            capture={undefined}
            onChange={(e) => {
              const files = Array.from(e.target.files || []);
              e.target.value = '';
              if (files.length) addFiles(files);
            }}
          />

          <label className="dv-label">
            {copy.divar_title || 'عنوان آگهی'} <i>*</i>
          </label>
          <input className="dv-input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} />

          <label className="dv-label">
            {copy.divar_desc || 'توضیحات آگهی'} <i>*</i>
          </label>
          <textarea className="dv-input dv-input--area" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />

          <div className="dv-post__footer">
            <button type="button" className="dv-btn dv-btn--block" disabled={busy} onClick={goNext}>
              {copy.divar_next || 'بعدی'}
            </button>
          </div>
        </div>
      ) : null}

      {screen === 2 ? (
        <div className="dv-post__body">
          <h3 className="dv-section-title">{copy.divar_cat_loc_title || 'دسته و محل آگهی'}</h3>

          <button type="button" className="dv-select-row" onClick={() => setSheet('category')}>
            <span className="dv-select-row__label">
              {copy.divar_category_short || 'دسته'} <i>*</i>
            </span>
            <strong className={categorySummary ? 'has-value' : ''}>
              {categorySummary || copy.divar_choose || 'انتخاب'}
              <em>‹</em>
            </strong>
          </button>
          <p className="dv-note">{copy.divar_cat_locked || 'پس از ثبت، دستهٔ آگهی قابل ویرایش نیست'}</p>

          <button type="button" className="dv-select-row" onClick={() => setSheet('location')}>
            <span className="dv-select-row__label">
              {copy.divar_ad_place || 'مکان آگهی'} <i>*</i>
            </span>
            <strong className={locationSummary ? 'has-value' : ''}>
              {locationSummary || copy.divar_choose || 'انتخاب'}
              <em>‹</em>
            </strong>
          </button>
          <p className="dv-note">{copy.divar_city_locked || 'پس از ثبت، شهر آگهی قابل ویرایش نیست'}</p>

          <h3 className="dv-section-title">{copy.divar_features || 'ویژگی‌ها'}</h3>
          {attrDefs.length ? (
            attrDefs.slice(0, 4).map((d) => (
              <button
                key={d.id}
                type="button"
                className="dv-select-row"
                onClick={() => {
                  setActiveAttr(d);
                  setSheet('attr');
                }}
              >
                <span className="dv-select-row__label">
                  {attrLabel(d, locale)}
                  {d.required ? ' *' : ''}
                </span>
                <strong className={attrValues[d.code] ? 'has-value' : ''}>
                  {attrValues[d.code] || copy.divar_choose || 'انتخاب'}
                  <em>‹</em>
                </strong>
              </button>
            ))
          ) : (
            <p className="dv-note">
              {isLeaf ? copy.seller_wizard_no_attrs : copy.divar_pick_category_first || 'اول دسته را انتخاب کنید'}
            </p>
          )}

          <div className="dv-post__footer">
            <button type="button" className="dv-btn dv-btn--block" disabled={busy} onClick={goNext}>
              {copy.divar_next || 'بعدی'}
            </button>
          </div>
        </div>
      ) : null}

      {screen === 3 ? (
        <form className="dv-post__body" onSubmit={(e) => void submitAll(e)}>
          {attrDefs.map((d) =>
            d.dataType === 'ENUM' || d.enumOptions?.length ? (
              <button
                key={d.id}
                type="button"
                className="dv-select-row"
                onClick={() => {
                  setActiveAttr(d);
                  setSheet('attr');
                }}
              >
                <span className="dv-select-row__label">
                  {attrLabel(d, locale)}
                  {d.required ? ' *' : ''}
                </span>
                <strong className={attrValues[d.code] ? 'has-value' : ''}>
                  {attrValues[d.code] || copy.divar_choose || 'انتخاب'}
                  <em>‹</em>
                </strong>
              </button>
            ) : (
              <label key={d.id} className="dv-field">
                <span>
                  {attrLabel(d, locale)}
                  {d.required ? ' *' : ''}
                </span>
                <input
                  className="dv-input"
                  value={attrValues[d.code] || ''}
                  onChange={(e) => setAttrValues((s) => ({ ...s, [d.code]: e.target.value }))}
                />
              </label>
            ),
          )}

          <label className="dv-field">
            <span>
              {copy.divar_price || 'قیمت'} ({copy.divar_toman || 'تومان'}) <i>*</i>
            </span>
            <input
              className="dv-input"
              inputMode="numeric"
              value={priceToman}
              onChange={(e) => setPriceToman(formatGrouped(e.target.value))}
              required
            />
            {priceNum > 0 ? <small className="dv-price-words">{formatTomanWords(priceNum, locale)}</small> : null}
          </label>

          <label className="dv-check">
            <span>{copy.divar_price_fixed || 'قیمت مقطوع است'}</span>
            <input type="checkbox" checked={priceFixed} onChange={(e) => setPriceFixed(e.target.checked)} />
          </label>
          <label className="dv-check">
            <span>{copy.divar_want_trade || 'مایلم معاوضه کنم'}</span>
            <input type="checkbox" checked={wantTrade} onChange={(e) => setWantTrade(e.target.checked)} />
          </label>

          <label className="dv-field">
            <span>{copy.divar_stock || 'موجودی'}</span>
            <input className="dv-input" inputMode="decimal" value={stockQty} onChange={(e) => setStockQty(e.target.value)} />
          </label>

          <div className="dv-post__footer">
            <button type="submit" className="dv-btn dv-btn--block" disabled={busy || !orgId}>
              {busy ? '…' : copy.divar_submit || 'ثبت آگهی'}
            </button>
          </div>
        </form>
      ) : null}

      {sheet ? (
        <div className="dv-sheet" role="dialog" aria-modal>
          <header className="dv-sheet__head">
            <button type="button" onClick={() => { setSheet(null); setActiveAttr(null); }}>
              {copy.seller_wizard_back || 'بازگشت'}
            </button>
            <strong>
              {sheet === 'category'
                ? copy.divar_category || 'دسته‌بندی'
                : sheet === 'location'
                  ? copy.divar_ad_place || 'مکان آگهی'
                  : activeAttr
                    ? attrLabel(activeAttr, locale)
                    : copy.divar_features || 'ویژگی‌ها'}
            </strong>
            <span />
          </header>

          {sheet === 'category' ? (
            <div className="dv-sheet__body">
              <input
                className="dv-input"
                value={catQuery}
                onChange={(e) => setCatQuery(e.target.value)}
                placeholder={copy.seller_wizard_cat_search_ph}
              />
              {catQuery.trim() ? (
                <ul className="dv-sheet__list">
                  {searchHits.map((c) => (
                    <li key={c.id}>
                      <button type="button" onClick={() => selectCategory(c.id)}>
                        {pathFor(categories, c.id).map((p) => catLabel(p, locale)).join(' › ')}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <>
                  <div className="dv-sheet__crumbs">
                    <button type="button" onClick={() => setBrowseParentId(null)}>
                      {copy.seller_wizard_browse_root}
                    </button>
                    {browsePath.map((p) => (
                      <button key={p.id} type="button" onClick={() => setBrowseParentId(p.id)}>
                        {catLabel(p, locale)}
                      </button>
                    ))}
                  </div>
                  <ul className="dv-sheet__list">
                    {browseChildren.map((c) => {
                      const hasKids = (childrenMap.get(c.id) || []).length > 0;
                      return (
                        <li key={c.id}>
                          <button type="button" onClick={() => selectCategory(c.id)}>
                            <span>{catLabel(c, locale)}</span>
                            <em>{hasKids ? '‹' : ''}</em>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </div>
          ) : null}

          {sheet === 'location' ? (
            <div className="dv-sheet__body">
              {facilities.length ? (
                <label className="dv-field">
                  <span>{copy.seller_facilities || 'انبارها'}</span>
                  <select
                    className="dv-input"
                    value={facilityId}
                    onChange={(e) => setFacilityId(e.target.value)}
                  >
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
              <LocationMapPicker
                value={mapLoc}
                onChange={setMapLoc}
                copy={copy}
                height={280}
              />
              <button
                type="button"
                className="dv-btn dv-btn--block"
                onClick={() => {
                  if (!mapLoc && !facilityId) {
                    setError(copy.divar_need_location || 'مکان را مشخص کنید');
                    return;
                  }
                  setSheet(null);
                }}
              >
                {copy.divar_confirm_location || 'تأیید مکان'}
              </button>
            </div>
          ) : null}

          {sheet === 'attr' && activeAttr ? (
            <div className="dv-sheet__body">
              {Array.isArray(activeAttr.enumOptions) && activeAttr.enumOptions.length ? (
                <ul className="dv-sheet__list">
                  {activeAttr.enumOptions.map((opt) => (
                    <li key={opt}>
                      <button
                        type="button"
                        className={attrValues[activeAttr.code] === opt ? 'is-active' : undefined}
                        onClick={() => {
                          setAttrValues((s) => ({ ...s, [activeAttr.code]: opt }));
                          setSheet(null);
                          setActiveAttr(null);
                        }}
                      >
                        {opt}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <label className="dv-field">
                  <span>{attrLabel(activeAttr, locale)}</span>
                  <input
                    className="dv-input"
                    autoFocus
                    value={attrValues[activeAttr.code] || ''}
                    onChange={(e) => setAttrValues((s) => ({ ...s, [activeAttr!.code]: e.target.value }))}
                  />
                  <button
                    type="button"
                    className="dv-btn dv-btn--block"
                    style={{ marginTop: 12 }}
                    onClick={() => {
                      setSheet(null);
                      setActiveAttr(null);
                    }}
                  >
                    {copy.divar_confirm || 'تأیید'}
                  </button>
                </label>
              )}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
