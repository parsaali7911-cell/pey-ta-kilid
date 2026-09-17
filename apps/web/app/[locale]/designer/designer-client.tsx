'use client';

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiUrl } from '@/lib/api';
import type { Locale } from '@/lib/i18n-public';

type Status = {
  enabled: boolean;
  dailyLimit: number;
  usedInLast24h: number;
  remaining: number;
  provider: string;
  imageEditConfigured: boolean;
  providerStatus: string;
  note?: string;
};

type Job = {
  publicId: string;
  status: 'QUEUED' | 'READY' | 'FAILED' | 'PROVIDER_UNAVAILABLE';
  prompt: string;
  listingPublicId: string | null;
  listingSlug: string | null;
  listingTitle: string | null;
  resultNote: string | null;
  resultImageUrl: string | null;
  errorMessage: string | null;
};

type CatalogItem = {
  publicId: string;
  slug: string;
  title: string;
  imageUrl: string | null;
};

const SESSION_KEY = 'peytakilid_designer_session';
const MAX_UPLOAD_EDGE = 2048;
const MAX_UPLOAD_BYTES = 3.5 * 1024 * 1024;

function defaultPromptForListing(locale: Locale, title: string): string {
  if (locale === 'en') {
    return `Apply ONLY “${title}” onto the floor. Keep the exact color/pattern from the product photo. Do not invent a different material.`;
  }
  if (locale === 'ar') {
    return `طبّق فقط «${title}» على الأرضية مع الحفاظ على اللون والنقش من صورة المنتج. لا تخترع خامة أخرى.`;
  }
  return `فقط محصول «${title}» را روی کف اعمال کن. رنگ، نقش و بافت عکس کالا دقیقاً حفظ شود؛ مادهٔ دیگری اختراع نشود.`;
}

async function prepareImageForUpload(file: File): Promise<File> {
  const type = (file.type || '').toLowerCase();
  if (type.includes('heic') || type.includes('heif') || /\.heic$/i.test(file.name) || /\.heif$/i.test(file.name)) {
    throw new Error('HEIC_NOT_SUPPORTED');
  }
  if (!type.startsWith('image/') && type !== '') return file;
  if (file.size <= 900_000 && (type === 'image/jpeg' || type === 'image/webp' || type === 'image/png')) {
    return file;
  }
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_UPLOAD_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.82),
    );
    if (!blob) return file;
    if (blob.size > MAX_UPLOAD_BYTES) {
      const tighter: Blob | null = await new Promise((resolve) =>
        canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.7),
      );
      if (tighter) {
        return new File([tighter], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
      }
    }
    return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

export default function DesignerClient({
  locale,
  copy,
  initialListingRef = '',
}: {
  locale: Locale;
  copy: Record<string, string>;
  initialListingRef?: string;
}) {
  const [session, setSession] = useState('');
  const [status, setStatus] = useState<Status | null>(null);
  const [spaceId, setSpaceId] = useState('');
  const [spacePreviewUrl, setSpacePreviewUrl] = useState('');
  const [listingRef, setListingRef] = useState(initialListingRef);
  const [listingTitle, setListingTitle] = useState('');
  const [listingSlug, setListingSlug] = useState('');
  const [listingImageUrl, setListingImageUrl] = useState('');
  const [productMediaId, setProductMediaId] = useState('');
  const [productPreviewUrl, setProductPreviewUrl] = useState('');
  const [productPhotoSource, setProductPhotoSource] = useState<'catalog' | 'phone'>('catalog');
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [catalogQ, setCatalogQ] = useState('');
  const [catalogOpen, setCatalogOpen] = useState(!initialListingRef.trim());
  const [prompt, setPrompt] = useState('');
  const [job, setJob] = useState<Job | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState<'space' | 'product' | false>(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const promptTouched = useRef(false);
  const spaceFileRef = useRef<HTMLInputElement>(null);
  const spaceCameraRef = useRef<HTMLInputElement>(null);
  const productFileRef = useRef<HTMLInputElement>(null);
  const productCameraRef = useRef<HTMLInputElement>(null);
  const sessionRef = useRef('');
  sessionRef.current = session;

  const refreshStatus = useCallback(async () => {
    const res = await fetch(apiUrl('/designer/status'));
    if (res.ok) setStatus(await res.json());
  }, []);

  const bindListing = useCallback(
    async (ref: string, opts?: { fillPrompt?: boolean }) => {
      const trimmed = ref.trim();
      if (!trimmed) return;
      const res = await fetch(
        apiUrl(`/designer/bind-listing?listingRef=${encodeURIComponent(trimmed)}&locale=${locale}`),
      );
      if (!res.ok) throw new Error(copy.designer_listing_missing || 'Listing not found');
      const data = await res.json();
      setListingRef(data.slug || trimmed);
      setListingTitle(data.title || '');
      setListingSlug(data.slug || '');
      setListingImageUrl(data.imageUrl || '');
      if (opts?.fillPrompt !== false && !promptTouched.current && data.title) {
        setPrompt(defaultPromptForListing(locale, data.title));
      }
      setMsg(copy.designer_catalog_loaded.replace('{name}', data.title || trimmed));
    },
    [copy.designer_catalog_loaded, copy.designer_listing_missing, locale],
  );

  const loadCatalog = useCallback(
    async (q?: string) => {
      const qs = new URLSearchParams({ limit: '18' });
      if (q?.trim()) qs.set('q', q.trim());
      const res = await fetch(apiUrl(`/designer/catalog?${qs.toString()}`));
      if (!res.ok) return;
      const data = (await res.json()) as CatalogItem[];
      setCatalog(Array.isArray(data) ? data : []);
    },
    [],
  );

  useEffect(() => {
    void (async () => {
      let token = '';
      try {
        token = localStorage.getItem(SESSION_KEY) || '';
      } catch {
        token = '';
      }
      if (!token) {
        const res = await fetch(apiUrl('/designer/session'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ locale }),
        });
        const data = await res.json();
        token = data.sessionToken;
        try {
          localStorage.setItem(SESSION_KEY, token);
        } catch {
          /* ignore */
        }
      }
      setSession(token);
      await refreshStatus();
      // Only preload catalog picker when user did not arrive with a specific listing.
      if (!initialListingRef.trim()) {
        await loadCatalog();
      }
    })();
  }, [initialListingRef, locale, loadCatalog, refreshStatus]);

  useEffect(() => {
    if (!initialListingRef.trim()) return;
    void bindListing(initialListingRef, { fillPrompt: true })
      .then(() => setCatalogOpen(false))
      .catch(() => {
        setCatalogOpen(true);
        void loadCatalog();
      });
  }, [bindListing, initialListingRef, loadCatalog]);

  useEffect(() => {
    if (!catalogOpen) return;
    const t = setTimeout(() => {
      void loadCatalog(catalogQ);
    }, 280);
    return () => clearTimeout(t);
  }, [catalogOpen, catalogQ, loadCatalog]);

  async function uploadKind(kind: 'space' | 'listing', file: File) {
    setError('');
    setMsg('');
    setUploading(kind === 'space' ? 'space' : 'product');
    try {
      const prepared = await prepareImageForUpload(file);
      const localUrl = URL.createObjectURL(prepared);
      if (kind === 'space') {
        setSpacePreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return localUrl;
        });
      } else {
        setProductPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return localUrl;
        });
      }
      const fd = new FormData();
      fd.append('file', prepared);
      const res = await fetch(apiUrl(`/designer/upload/${kind}?locale=${locale}`), {
        method: 'POST',
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (String(data.message || '').includes('HEIC') || data.code === 'HEIC_NOT_SUPPORTED') {
          setError(copy.designer_heic_unsupported);
        } else {
          setError(data.message || `Upload failed (${res.status})`);
        }
        return;
      }
      if (kind === 'space') {
        setSpaceId(data.publicId);
        setMsg(copy.designer_space_uploaded);
      } else {
        setProductMediaId(data.publicId);
        setProductPhotoSource('phone');
        setMsg(copy.designer_product_uploaded || 'عکس کالا از گوشی بارگذاری شد');
      }
      await refreshStatus();
    } catch (err) {
      if (err instanceof Error && err.message === 'HEIC_NOT_SUPPORTED') {
        setError(copy.designer_heic_unsupported);
      } else {
        setError(err instanceof Error ? err.message : 'Upload failed');
      }
    } finally {
      setUploading(false);
    }
  }

  function clearPhoneProductPhoto() {
    setProductMediaId('');
    setProductPhotoSource('catalog');
    setProductPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return '';
    });
  }

  async function onGenerate(e: FormEvent) {
    e.preventDefault();
    setError('');
    setMsg('');
    setBusy(true);
    setJob(null);
    try {
      if (listingRef.trim()) {
        await bindListing(listingRef, { fillPrompt: false }).catch(() => undefined);
      }
      const res = await fetch(apiUrl('/designer/generate'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spaceMediaPublicId: spaceId,
          listingRef: listingRef.trim(),
          productMediaPublicId: productMediaId.trim() || undefined,
          prompt,
          locale,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || data.code || `Generate failed (${res.status})`);
        setBusy(false);
        return;
      }
      setJob(data as Job);
      if (data.listingTitle) setListingTitle(data.listingTitle);
      if (data.listingSlug) setListingSlug(data.listingSlug);
      if (data.status === 'PROVIDER_UNAVAILABLE') {
        setMsg(data.resultNote || copy.designer_requires_cred);
      } else if (data.status === 'READY') {
        setMsg(copy.designer_saved);
      } else if (data.status === 'FAILED') {
        setError(data.errorMessage || copy.designer_failed);
      }
      await refreshStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  const providerReady = status?.imageEditConfigured;
  const productReady = Boolean((listingSlug || listingTitle) && (productMediaId || listingImageUrl));
  const canGenerate = Boolean(
    spaceId &&
      listingRef.trim() &&
      productReady &&
      prompt.trim().length >= 8 &&
      status?.enabled &&
      !busy &&
      !uploading,
  );

  const steps = useMemo(
    () => [
      { done: Boolean(spaceId), label: copy.designer_step_space },
      { done: Boolean(listingSlug || listingTitle), label: copy.designer_step_product },
      { done: Boolean(prompt.trim().length >= 8), label: copy.designer_step_prompt },
    ],
    [copy.designer_step_product, copy.designer_step_prompt, copy.designer_step_space, listingSlug, listingTitle, prompt, spaceId],
  );

  const activeProductPreview = productPhotoSource === 'phone' && productPreviewUrl ? productPreviewUrl : listingImageUrl;

  return (
    <div className="designer-grid public-workspace">
      {!status?.enabled ? <p className="pk-notice">{copy.designer_disabled}</p> : null}
      <p className="pk-notice" style={{ color: 'var(--sc-muted)' }}>
        {providerReady ? copy.designer_provider_ready : copy.designer_requires_cred}
      </p>

      <ol className="designer-steps" style={{ listStyle: 'none', padding: 0, display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {steps.map((s, i) => (
          <li
            key={s.label}
            className={s.done ? 'result' : undefined}
            style={{
              padding: '0.35rem 0.7rem',
              borderRadius: 999,
              border: '1px solid var(--sc-border, #ddd)',
              background: s.done ? 'rgba(40,140,90,0.12)' : 'transparent',
              fontSize: '0.85rem',
            }}
          >
            {i + 1}. {s.label}
          </li>
        ))}
      </ol>

      <form className="form designer-form" onSubmit={onGenerate}>
        <div className="designer-catalog-field">
          <strong>{copy.designer_space}</strong>
          <p className="panel-muted" style={{ margin: '0.35rem 0 0.55rem', fontSize: '0.85rem' }}>
            {copy.designer_space_hint || 'عکس فضا را از گالری یا دوربین گوشی بفرستید.'}
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            <button
              type="button"
              className="mp-btn"
              disabled={!session || Boolean(uploading) || busy}
              onClick={() => spaceFileRef.current?.click()}
            >
              {copy.designer_from_gallery || 'از گالری گوشی'}
            </button>
            <button
              type="button"
              className="mp-btn"
              disabled={!session || Boolean(uploading) || busy}
              onClick={() => spaceCameraRef.current?.click()}
            >
              {copy.designer_from_camera || 'دوربین'}
            </button>
          </div>
          <input
            ref={spaceFileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/*"
            style={{ display: 'none' }}
            disabled={!session || Boolean(uploading) || busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) void uploadKind('space', f);
            }}
          />
          <input
            ref={spaceCameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: 'none' }}
            disabled={!session || Boolean(uploading) || busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) void uploadKind('space', f);
            }}
          />
          {uploading === 'space' ? <small>{copy.designer_uploading}</small> : null}
          {spaceId && uploading !== 'space' ? <small className="ok-mark">{copy.designer_uploaded}</small> : null}
        </div>

        {spacePreviewUrl ? (
          <div className="designer-catalog-field">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={spacePreviewUrl}
              alt={copy.designer_space}
              style={{ width: '100%', maxWidth: 360, borderRadius: 12, border: '1px solid var(--sc-border, #ddd)' }}
            />
          </div>
        ) : null}

        <div className="designer-catalog-field">
          <strong>{copy.designer_step_product}</strong>
          <p className="panel-muted" style={{ margin: '0.35rem 0 0.55rem', fontSize: '0.85rem' }}>
            {copy.designer_product_photo_hint ||
              'عکس کالا را از کاتالوگ بگیرید یا خودتان از گوشی آپلود کنید.'}
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.65rem' }}>
            <button
              type="button"
              className="mp-btn"
              style={{
                borderColor: productPhotoSource === 'catalog' ? 'var(--sc-teal, #2a6b5c)' : undefined,
                background: productPhotoSource === 'catalog' ? 'rgba(42,107,92,0.1)' : undefined,
              }}
              disabled={busy}
              onClick={() => {
                clearPhoneProductPhoto();
                setCatalogOpen(true);
                void loadCatalog(catalogQ);
              }}
            >
              {copy.designer_product_from_catalog || 'عکس از کاتالوگ کالا'}
            </button>
            <button
              type="button"
              className="mp-btn"
              style={{
                borderColor: productPhotoSource === 'phone' ? 'var(--sc-teal, #2a6b5c)' : undefined,
                background: productPhotoSource === 'phone' ? 'rgba(42,107,92,0.1)' : undefined,
              }}
              disabled={!session || Boolean(uploading) || busy}
              onClick={() => productFileRef.current?.click()}
            >
              {copy.designer_product_from_phone || 'آپلود عکس کالا از گوشی'}
            </button>
            <button
              type="button"
              className="mp-btn"
              disabled={!session || Boolean(uploading) || busy}
              onClick={() => productCameraRef.current?.click()}
            >
              {copy.designer_from_camera || 'دوربین'}
            </button>
          </div>
          <input
            ref={productFileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/*"
            style={{ display: 'none' }}
            disabled={!session || Boolean(uploading) || busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) void uploadKind('listing', f);
            }}
          />
          <input
            ref={productCameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: 'none' }}
            disabled={!session || Boolean(uploading) || busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) void uploadKind('listing', f);
            }}
          />
          {uploading === 'product' ? <small>{copy.designer_uploading}</small> : null}
          {productMediaId && uploading !== 'product' ? (
            <small className="ok-mark">{copy.designer_product_uploaded || 'عکس کالا بارگذاری شد'}</small>
          ) : null}

          {(listingTitle || activeProductPreview) && !catalogOpen ? (
            <div className="designer-selected-product" style={{ marginTop: '0.65rem' }}>
              {activeProductPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="designer-selected-product__img" src={activeProductPreview} alt={listingTitle} />
              ) : (
                <div className="designer-selected-product__img" />
              )}
              <div className="designer-selected-product__meta">
                <strong>{listingTitle || listingRef}</strong>
                <span className="panel-muted">
                  {productPhotoSource === 'phone' && productMediaId
                    ? copy.designer_using_phone_product || 'در حال استفاده از عکس آپلودشده از گوشی'
                    : copy.designer_selected_only || 'محصول انتخاب‌شده برای طراحی'}
                </span>
                <div className="designer-selected-product__actions">
                  {listingSlug ? (
                    <a className="mp-btn" href={`/${locale}/catalog/${listingSlug}`}>
                      {copy.designer_view_listing}
                    </a>
                  ) : null}
                  <button
                    type="button"
                    className="mp-btn"
                    onClick={() => {
                      setCatalogOpen(true);
                      void loadCatalog(catalogQ);
                    }}
                  >
                    {copy.designer_change_product || 'تعویض محصول'}
                  </button>
                  {productMediaId ? (
                    <button type="button" className="mp-btn" onClick={clearPhoneProductPhoto}>
                      {copy.designer_use_catalog_photo || 'استفاده از عکس کاتالوگ'}
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          ) : (
            <>
              <input
                value={catalogQ}
                onChange={(e) => setCatalogQ(e.target.value)}
                placeholder={copy.designer_pick_product_ph}
                disabled={busy}
                style={{ marginTop: '0.5rem' }}
              />
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                  gap: '0.55rem',
                  marginTop: '0.65rem',
                }}
              >
                {catalog.map((item) => {
                  const selected = listingSlug === item.slug || listingRef === item.slug;
                  return (
                    <button
                      key={item.publicId}
                      type="button"
                      className="mp-btn"
                      style={{
                        display: 'grid',
                        gap: '0.35rem',
                        textAlign: 'start',
                        padding: '0.45rem',
                        borderColor: selected ? 'var(--sc-teal, #2a6b5c)' : undefined,
                        background: selected ? 'rgba(42,107,92,0.08)' : undefined,
                      }}
                      onClick={() => {
                        void bindListing(item.slug, { fillPrompt: true }).then(() => {
                          setCatalogOpen(false);
                          if (!productMediaId) setProductPhotoSource('catalog');
                        });
                      }}
                      disabled={busy}
                    >
                      {item.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.imageUrl}
                          alt={item.title}
                          style={{ width: '100%', height: 88, objectFit: 'cover', borderRadius: 8 }}
                        />
                      ) : (
                        <div style={{ height: 88, borderRadius: 8, background: 'var(--sc-surface-2, #eee)' }} />
                      )}
                      <span style={{ fontSize: '0.82rem', lineHeight: 1.3 }}>{item.title}</span>
                    </button>
                  );
                })}
              </div>
              {(listingTitle || listingSlug) && (
                <button type="button" className="mp-btn" style={{ marginTop: '0.65rem' }} onClick={() => setCatalogOpen(false)}>
                  {copy.designer_use_selected || 'ادامه با همین محصول'}
                </button>
              )}
            </>
          )}
        </div>

        <label>
          {copy.designer_prompt}
          <textarea
            value={prompt}
            onChange={(e) => {
              promptTouched.current = true;
              setPrompt(e.target.value);
            }}
            placeholder={copy.designer_prompt_ph}
            required
            minLength={8}
            rows={4}
          />
        </label>

        <button className="mp-btn mp-btn--primary" type="submit" disabled={!canGenerate}>
          {busy ? copy.designer_processing : copy.designer_generate}
        </button>
      </form>

      {error ? (
        <p className="pk-notice" style={{ color: '#9b3b3b' }}>
          {error}
        </p>
      ) : null}
      {msg ? <p className="pk-notice">{msg}</p> : null}

      {job ? (
        <div className="designer-result">
          <h3>{copy.designer_result}</h3>
          {busy || job.status === 'QUEUED' ? (
            <p className="pk-notice designer-loading">{copy.designer_processing}</p>
          ) : null}
          {job.status === 'PROVIDER_UNAVAILABLE' ? (
            <p className="pk-notice">{job.resultNote || copy.designer_requires_cred}</p>
          ) : null}
          {job.status === 'FAILED' ? (
            <p className="pk-notice" style={{ color: '#9b3b3b' }}>
              {copy.designer_failed}
              {job.errorMessage ? `: ${job.errorMessage}` : ''}
            </p>
          ) : null}
          {job.status === 'READY' && job.resultImageUrl ? (
            <div className="designer-result-image" style={{ marginBottom: '0.75rem' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={job.resultImageUrl}
                alt={job.listingTitle || copy.designer_result}
                className="designer-result-img"
                style={{
                  width: '100%',
                  maxWidth: 640,
                  borderRadius: 12,
                  border: '1px solid var(--sc-border, #ddd)',
                }}
              />
            </div>
          ) : null}
          {job.status === 'READY' && job.resultNote ? (
            <p className="pk-notice">{job.resultNote}</p>
          ) : null}

          <div className="designer-actions">
            <button type="button" className="mp-btn" onClick={() => setJob(null)}>
              {copy.designer_another}
            </button>
            {(job.listingSlug || listingSlug) && (
              <a
                className="mp-btn mp-btn--primary"
                href={`/${locale}/catalog/${job.listingSlug || listingSlug}`}
              >
                {copy.designer_view_listing}
              </a>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
