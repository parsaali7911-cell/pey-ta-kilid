'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiAuthed, fetchMe, getAccessToken } from '@/lib/auth-client';
import { apiUrl } from '@/lib/api';
import type { Locale } from '@/lib/i18n-public';
import { PROFESSIONAL_SPECIALTY_OPTIONS } from '@/lib/lexicon/specialties';

type PublicPro = {
  slug: string;
  name: string;
  specialtyLabel?: string | null;
  specialty?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  profile: {
    displayName: string;
    bio?: string | null;
    yearsExperience?: number | null;
    avatarUrl?: string | null;
    secondarySpecialtyLabels?: Array<string | null>;
    projectTypes?: string[];
    serviceRadiusKm?: number | null;
    priceRangeMin?: number | null;
    priceRangeMax?: number | null;
    priceCurrency?: string | null;
    priceNote?: string | null;
    availabilityNote?: string | null;
    profileScore: number;
    reviewCount: number;
    ratingAvg?: number | null;
    mobileVerified: boolean;
    identityVerified: boolean;
    nationalIdLast4?: string | null;
    portfolio: Array<{ id: string; url: string; caption?: string | null }>;
  } | null;
  locations: Array<{ city?: string; province?: string | null }>;
  reviews: Array<{
    publicId: string;
    authorName: string;
    rating: number;
    body?: string | null;
    createdAt: string;
  }>;
};

export default function ProfessionalPublicClient({
  locale,
  slug,
  copy,
}: {
  locale: Locale;
  slug: string;
  copy: Record<string, string>;
}) {
  const [data, setData] = useState<PublicPro | null>(null);
  const [error, setError] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await fetch(apiUrl(`/professionals/by-slug/${encodeURIComponent(slug)}?locale=${locale}`));
    if (!res.ok) {
      setError(copy.pro_not_found || 'یافت نشد');
      return;
    }
    setData(await res.json());
  }

  useEffect(() => {
    void load();
  }, [slug, locale]);

  async function submitReview(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setMsg('');
    try {
      const path = getAccessToken()
        ? `/professionals/${encodeURIComponent(slug)}/reviews/authenticated`
        : `/professionals/${encodeURIComponent(slug)}/reviews`;
      if (getAccessToken()) {
        await apiAuthed(path, {
          method: 'POST',
          json: { authorName: authorName.trim(), rating, body: body.trim() || undefined },
        });
      } else {
        const res = await fetch(apiUrl(path), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            authorName: authorName.trim(),
            rating,
            body: body.trim() || undefined,
          }),
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(j.message || `Failed ${res.status}`);
      }
      setMsg(copy.pro_review_thanks || 'نظر ثبت شد');
      setBody('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  if (!data && !error) return <p className="pk-notice">{copy.panel_loading || '…'}</p>;
  if (error && !data) return <p className="panel-err">{error}</p>;
  if (!data) return null;

  const p = data.profile;
  const city = data.locations[0]?.city;

  return (
    <div className="panel-workspace" style={{ padding: '0.5rem 0 2rem' }}>
      <header style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {p?.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={p.avatarUrl}
            alt={p.displayName}
            style={{ width: 96, height: 96, borderRadius: 16, objectFit: 'cover' }}
          />
        ) : (
          <div style={{ width: 96, height: 96, borderRadius: 16, background: '#eee' }} />
        )}
        <div style={{ flex: 1, minWidth: 220 }}>
          <h1 style={{ margin: 0 }}>{p?.displayName || data.name}</h1>
          <p className="panel-muted" style={{ margin: '0.35rem 0' }}>
            {[data.specialtyLabel, city].filter(Boolean).join(' · ')}
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span className="mp-btn" style={{ pointerEvents: 'none' }}>
              {copy.pro_score_label || 'رتبه پروفایل'}: {p?.profileScore ?? 0}/100
            </span>
            {p?.identityVerified ? (
              <span className="panel-ok">{copy.pro_identity_verified || 'هویت تأییدشده'}</span>
            ) : p?.mobileVerified ? (
              <span className="panel-muted">{copy.pro_mobile_verified || 'موبایل تأییدشده'}</span>
            ) : null}
            {p?.ratingAvg != null ? (
              <span className="panel-muted">
                ★ {p.ratingAvg.toFixed(1)} ({p.reviewCount})
              </span>
            ) : null}
          </div>
        </div>
      </header>

      {p?.bio ? <p style={{ marginTop: '1rem', whiteSpace: 'pre-wrap' }}>{p.bio}</p> : null}

      <div style={{ display: 'grid', gap: '0.35rem', marginTop: '1rem' }}>
        {p?.yearsExperience != null ? (
          <p className="panel-muted">
            {copy.pro_years || 'سابقه'}: {p.yearsExperience} {copy.pro_years_unit || 'سال'}
          </p>
        ) : null}
        {p?.priceNote || p?.priceRangeMin != null ? (
          <p className="panel-muted">
            {copy.pro_price || 'محدوده قیمت'}:{' '}
            {p.priceNote ||
              `${p.priceRangeMin ?? '—'} – ${p.priceRangeMax ?? '—'} ${p.priceCurrency || 'IRR'}`}
          </p>
        ) : null}
        {p?.availabilityNote ? <p className="panel-muted">{p.availabilityNote}</p> : null}
      </div>

      {p?.portfolio?.length ? (
        <section style={{ marginTop: '1.5rem' }}>
          <h2>{copy.pro_portfolio || 'نمونه کارها'}</h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))',
              gap: '0.6rem',
            }}
          >
            {p.portfolio.map((item) => (
              <figure key={item.id} style={{ margin: 0 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.url}
                  alt={item.caption || ''}
                  style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 10 }}
                />
                {item.caption ? <figcaption className="panel-muted">{item.caption}</figcaption> : null}
              </figure>
            ))}
          </div>
        </section>
      ) : null}

      <section style={{ marginTop: '1.75rem' }}>
        <h2>
          {copy.pro_reviews || 'نظرات مشتریان'} ({data.reviews.length})
        </h2>
        <ul className="panel-list">
          {data.reviews.map((r) => (
            <li key={r.publicId}>
              <strong>
                {'★'.repeat(r.rating)} {r.authorName}
              </strong>
              {r.body ? <div>{r.body}</div> : null}
            </li>
          ))}
          {!data.reviews.length ? <li className="panel-muted">{copy.pro_no_reviews || 'هنوز نظری نیست'}</li> : null}
        </ul>

        <form className="form" onSubmit={submitReview} style={{ marginTop: '1rem', maxWidth: 480 }}>
          <h3>{copy.pro_leave_review || 'ثبت نظر'}</h3>
          <label>
            {copy.pro_review_name || 'نام شما'}
            <input value={authorName} onChange={(e) => setAuthorName(e.target.value)} required minLength={2} />
          </label>
          <label>
            {copy.pro_review_rating || 'امتیاز'}
            <select value={rating} onChange={(e) => setRating(Number(e.target.value))}>
              {[5, 4, 3, 2, 1].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label>
            {copy.pro_review_body || 'متن نظر'}
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} />
          </label>
          <button className="mp-btn mp-btn--primary" type="submit" disabled={busy}>
            {copy.pro_review_submit || 'ارسال نظر'}
          </button>
        </form>
        {msg ? <p className="panel-ok">{msg}</p> : null}
        {error ? <p className="panel-err">{error}</p> : null}
      </section>
    </div>
  );
}

export function ProfessionalOnboardWizard({
  locale,
  copy,
  initialSpecialty,
  initialCity,
}: {
  locale: Locale;
  copy: Record<string, string>;
  initialSpecialty?: string;
  initialCity?: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [displayName, setDisplayName] = useState('');
  const [specialty, setSpecialty] = useState(initialSpecialty || 'tile_installation');
  const [city, setCity] = useState(initialCity || 'Tehran');
  const [mobilePhone, setMobilePhone] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [devCode, setDevCode] = useState('');
  const [orgId, setOrgId] = useState('');
  const [slug, setSlug] = useState('');
  const [score, setScore] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const steps = useMemo(
    () => [
      copy.pro_step_identity || 'هویت',
      copy.pro_step_otp || 'تأیید موبایل',
      copy.pro_step_photo || 'عکس و تکمیل',
    ],
    [copy],
  );

  async function createProfile(e: FormEvent) {
    e.preventDefault();
    if (!getAccessToken()) {
      router.push(
        `/${locale}/register?intent=professional&specialty=${encodeURIComponent(specialty)}&city=${encodeURIComponent(city)}`,
      );
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await apiAuthed<{
        organization: { id: string; slug: string };
        otp?: { devCode?: string; phone?: string };
        profile?: { profileScore?: number };
      }>('/professionals/onboard', {
        method: 'POST',
        json: { displayName, specialty, city, mobilePhone, nationalId },
      });
      setOrgId(res.organization.id);
      setSlug(res.organization.slug);
      setDevCode(res.otp?.devCode || '');
      setScore(res.profile?.profileScore || 0);
      setMsg(copy.pro_onboard_created || 'پروفایل ساخته شد — کد موبایل را وارد کنید');
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  async function confirmOtp(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const profile = await apiAuthed<{ profileScore: number }>(
        `/seller/professional-profile/mobile/confirm-otp?organizationId=${orgId}`,
        { method: 'POST', json: { mobilePhone, code: otpCode } },
      );
      setScore(profile.profileScore);
      setMsg(copy.pro_otp_ok || 'موبایل تأیید شد');
      setStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  async function uploadAvatar(file: File) {
    setBusy(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(
        apiUrl(`/seller/professional-profile/avatar?organizationId=${orgId}`),
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${getAccessToken()}` },
          body: fd,
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `Upload failed ${res.status}`);
      setScore(data.profileScore || 0);
      setMsg(copy.pro_avatar_ok || 'عکس پروفایل ذخیره شد');
      await fetchMe().catch(() => null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  async function enrich(e: FormEvent) {
    e.preventDefault();
    const bio = (e.target as HTMLFormElement).bio?.value;
    const years = (e.target as HTMLFormElement).years?.value;
    setBusy(true);
    try {
      const profile = await apiAuthed<{ profileScore: number; identityVerified?: boolean }>(
        `/seller/professional-profile?organizationId=${orgId}`,
        {
          method: 'PATCH',
          json: {
            bio: bio || undefined,
            yearsExperience: years ? Number(years) : undefined,
          },
        },
      );
      setScore(profile.profileScore);
      setMsg(
        profile.identityVerified
          ? copy.pro_identity_done || 'هویت کامل شد'
          : copy.pro_profile_saved || 'ذخیره شد',
      );
      router.push(`/${locale}/professionals/${slug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel-card" style={{ marginBottom: '1.5rem' }}>
      <h2>{copy.pro_onboard_title || 'ثبت‌نام متخصص'}</h2>
      <p className="panel-muted">
        {copy.pro_onboard_score_hint || 'رتبه پروفایل از ۱۰۰ — برای اعتماد بیشتر مشخصات کامل‌تر بگذارید.'}{' '}
        <strong>
          {score}/100
        </strong>
      </p>
      <ol style={{ display: 'flex', gap: '0.5rem', listStyle: 'none', padding: 0, flexWrap: 'wrap' }}>
        {steps.map((label, i) => (
          <li
            key={label}
            style={{
              padding: '0.3rem 0.7rem',
              borderRadius: 999,
              border: '1px solid #ddd',
              background: step === i + 1 ? 'rgba(40,140,90,0.12)' : 'transparent',
            }}
          >
            {i + 1}. {label}
          </li>
        ))}
      </ol>
      {error ? <p className="panel-err">{error}</p> : null}
      {msg ? <p className="panel-ok">{msg}</p> : null}

      {step === 1 ? (
        <form className="form" onSubmit={createProfile}>
          <label>
            {copy.pro_display_name || 'نام نمایشی'}
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required minLength={2} />
          </label>
          <label>
            {copy.pro_specialty || 'تخصص'}
            <select value={specialty} onChange={(e) => setSpecialty(e.target.value)}>
              {PROFESSIONAL_SPECIALTY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {locale === 'en' ? opt.labelEn : opt.labelFa}
                </option>
              ))}
            </select>
          </label>
          <label>
            {copy.pro_city || 'شهر'}
            <input value={city} onChange={(e) => setCity(e.target.value)} required />
          </label>
          <label>
            {copy.pro_mobile || 'موبایل'}
            <input
              value={mobilePhone}
              onChange={(e) => setMobilePhone(e.target.value)}
              placeholder="0912…"
              required
            />
          </label>
          <label>
            {copy.pro_national_id || 'کد ملی'}
            <input
              value={nationalId}
              onChange={(e) => setNationalId(e.target.value)}
              inputMode="numeric"
              required
              minLength={10}
              maxLength={10}
            />
          </label>
          <button className="mp-btn mp-btn--primary" disabled={busy} type="submit">
            {copy.pro_continue || 'ادامه'}
          </button>
        </form>
      ) : null}

      {step === 2 ? (
        <form className="form" onSubmit={confirmOtp}>
          <p className="panel-muted">{copy.pro_otp_hint || 'کد ۶ رقمی ارسال‌شده را وارد کنید.'}</p>
          {devCode ? <p className="panel-ok">DEV code: {devCode}</p> : null}
          <label>
            OTP
            <input value={otpCode} onChange={(e) => setOtpCode(e.target.value)} required minLength={4} />
          </label>
          <button className="mp-btn mp-btn--primary" disabled={busy} type="submit">
            {copy.pro_verify_mobile || 'تأیید موبایل'}
          </button>
        </form>
      ) : null}

      {step === 3 ? (
        <div className="form">
          <label>
            {copy.pro_avatar || 'عکس چهره / پروفایل'}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void uploadAvatar(f);
              }}
            />
          </label>
          <form onSubmit={enrich}>
            <label>
              {copy.pro_bio || 'معرفی کوتاه'}
              <textarea name="bio" rows={3} placeholder={copy.pro_bio_ph || 'سابقه و نوع کار…'} />
            </label>
            <label>
              {copy.pro_years || 'سابقه (سال)'}
              <input name="years" type="number" min={0} max={80} />
            </label>
            <button className="mp-btn mp-btn--primary" disabled={busy} type="submit">
              {copy.pro_finish || 'مشاهده پروفایل عمومی'}
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
