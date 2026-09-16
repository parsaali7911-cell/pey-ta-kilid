'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
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
  errorMessage: string | null;
};

const SESSION_KEY = 'peytakilid_designer_session';
const MAX_UPLOAD_EDGE = 2048;
const MAX_UPLOAD_BYTES = 3.5 * 1024 * 1024;

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
  const [listingRef, setListingRef] = useState(initialListingRef);
  const [listingTitle, setListingTitle] = useState('');
  const [listingSlug, setListingSlug] = useState('');
  const [prompt, setPrompt] = useState('');
  const [job, setJob] = useState<Job | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const sessionRef = useRef('');
  sessionRef.current = session;

  const refreshStatus = useCallback(async () => {
    const res = await fetch(apiUrl('/designer/status'));
    if (res.ok) setStatus(await res.json());
  }, []);

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
    })();
  }, [locale, refreshStatus]);

  async function uploadSpace(file: File) {
    setError('');
    setMsg('');
    setUploading(true);
    try {
      const prepared = await prepareImageForUpload(file);
      const fd = new FormData();
      fd.append('file', prepared);
      const res = await fetch(apiUrl(`/designer/upload/space?locale=${locale}`), {
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
      setSpaceId(data.publicId);
      setMsg(copy.designer_space_uploaded);
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

  async function onGenerate(e: FormEvent) {
    e.preventDefault();
    setError('');
    setMsg('');
    setBusy(true);
    setJob(null);
    try {
      const res = await fetch(apiUrl('/designer/generate'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spaceMediaPublicId: spaceId,
          listingRef: listingRef.trim(),
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

  return (
    <div className="designer-grid public-workspace">
      {!status?.enabled ? <p className="pk-notice">{copy.designer_disabled}</p> : null}
      {status?.note ? <p className="pk-notice" style={{ color: 'var(--sc-muted)' }}>{status.note}</p> : null}

      <form className="form designer-form" onSubmit={onGenerate}>
        <label>
          {copy.designer_space}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={!session || uploading || busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) void uploadSpace(f);
            }}
          />
          {uploading ? <small>{copy.designer_uploading}</small> : null}
          {spaceId && !uploading ? <small className="ok-mark">{copy.designer_uploaded}</small> : null}
        </label>

        <label>
          {copy.designer_listing_ref}
          <input
            value={listingRef}
            onChange={(e) => setListingRef(e.target.value)}
            placeholder={copy.designer_listing_ref_ph}
            required
          />
        </label>

        {listingTitle ? (
          <p className="pk-notice">
            {copy.designer_catalog_loaded.replace('{name}', listingTitle)}
            {listingSlug ? ` · ${listingSlug}` : ''}
          </p>
        ) : null}

        <label>
          {copy.designer_prompt}
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={copy.designer_prompt_ph}
            required
            minLength={8}
            rows={4}
          />
        </label>

        <button
          className="mp-btn mp-btn--primary"
          type="submit"
          disabled={busy || !spaceId || !listingRef.trim() || !prompt.trim() || !status?.enabled}
        >
          {copy.designer_generate}
        </button>
      </form>

      {error ? <p className="pk-notice" style={{ color: '#9b3b3b' }}>{error}</p> : null}
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
          {job.status === 'READY' && job.resultNote ? (
            <p className="pk-notice">{job.resultNote}</p>
          ) : null}

          <div className="designer-actions">
            <button type="button" className="mp-btn" onClick={() => setJob(null)}>
              {copy.designer_another}
            </button>
            {(job.listingSlug || listingSlug) && (
              <a className="mp-btn mp-btn--primary" href={`/${locale}/catalog/${job.listingSlug || listingSlug}`}>
                {copy.designer_view_listing}
              </a>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
