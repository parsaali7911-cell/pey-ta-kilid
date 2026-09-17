'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiPostClient, apiUrl } from '@/lib/api';
import type { Locale } from '@/lib/i18n-public';
import { PROFESSIONAL_SPECIALTY_OPTIONS } from '@/lib/lexicon/specialties';
import { ProfessionalOnboardWizard } from './professional-public-client';

type ProOrg = {
  id: string;
  name: string;
  slug: string;
  specialty?: string | null;
  specialtyLabel?: string | null;
  distanceKm?: number | null;
  profileScore?: number;
  avatarUrl?: string | null;
  identityVerified?: boolean;
  mobileVerified?: boolean;
  reviewCount?: number;
  ratingAvg?: number | null;
  locations: Array<{
    name: string;
    type: string;
    city?: string;
    province?: string;
    latitude?: number | null;
    longitude?: number | null;
    distanceKm?: number | null;
  }>;
};

export default function ProfessionalsClient({
  locale,
  copy,
  onboard = false,
  findMode = false,
  initialSpecialty,
  initialCity,
  projectId,
  requirementId,
}: {
  locale: Locale;
  copy: Record<string, string>;
  onboard?: boolean;
  findMode?: boolean;
  initialSpecialty?: string;
  initialCity?: string;
  projectId?: string;
  requirementId?: string;
}) {
  const router = useRouter();
  const [directory, setDirectory] = useState<ProOrg[]>([]);
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [specialty, setSpecialty] = useState(initialSpecialty || 'electrical');
  const [city, setCity] = useState(initialCity || 'Tehran');
  const [notes, setNotes] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (initialSpecialty) setSpecialty(initialSpecialty);
    if (initialCity) setCity(initialCity);
  }, [initialSpecialty, initialCity]);

  useEffect(() => {
    void (async () => {
      const qs = new URLSearchParams({ locale });
      if (findMode || city) qs.set('city', city);
      if (specialty) qs.set('specialty', specialty);
      qs.set('includeSellers', findMode ? '1' : '0');
      const dir = await fetch(apiUrl(`/professionals/directory?${qs.toString()}`)).then((r) => r.json());
      setDirectory(Array.isArray(dir) ? dir : []);
    })();
  }, [locale, findMode, city, specialty]);

  async function submitLead(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await apiPostClient('/professionals/leads', {
        contactName: contactName.trim(),
        contactPhone: contactPhone.trim() || undefined,
        specialtyHints: [specialty],
        city,
        countryCode: 'IR',
        notes: notes.trim() || undefined,
        sourceText: notes.trim() || specialty,
        locale,
        projectId: projectId || undefined,
        projectRequirementId: requirementId || undefined,
      });
      setMsg(copy.pro_lead_sent);
      setContactName('');
      setNotes('');
      if (projectId) {
        router.push(`/${locale}/projects/${projectId}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  // Divar-like: registration-only focus when self-identifying as a trade.
  if (onboard) {
    return (
      <div className="dv-page">
        <h1 className="dv-page__title">{copy.pro_onboard_title}</h1>
        <p className="dv-page__lead">{copy.pro_register_lead}</p>
        {error ? <p className="panel-err">{error}</p> : null}
        <ProfessionalOnboardWizard
          locale={locale}
          copy={copy}
          initialSpecialty={specialty}
          initialCity={city}
          compact
        />
      </div>
    );
  }

  return (
    <div className="dv-page">
      {findMode ? (
        <p className="dv-page__lead">
          {copy.pro_find_hint}: <strong>{specialty}</strong>
          {city ? (
            <>
              {' '}
              · <strong>{city}</strong>
            </>
          ) : null}
        </p>
      ) : null}
      {error ? <p className="panel-err">{error}</p> : null}
      {msg ? <p className="panel-ok">{msg}</p> : null}

      <section className="dv-card" style={{ marginBottom: '1rem' }}>
        <h2>{copy.pro_directory}</h2>
        <ul className="dv-list">
          {directory.map((o) => (
            <li key={o.id}>
              <a href={`/${locale}/professionals/${o.slug}`}>
                <strong>{o.name}</strong>
              </a>
              {o.specialtyLabel ? <span className="panel-muted"> · {o.specialtyLabel}</span> : null}
              <div className="panel-muted">
                {o.locations
                  .map((l) => [l.city, l.province].filter(Boolean).join('، '))
                  .filter(Boolean)
                  .join(' | ') || '—'}
              </div>
            </li>
          ))}
        </ul>
        {!directory.length ? <p className="panel-muted">{copy.pro_directory_empty}</p> : null}
      </section>

      <section className="dv-card">
        <h2>{copy.pro_request_title}</h2>
        <form className="dv-form" onSubmit={submitLead}>
          <label>
            {copy.auth_full_name}
            <input required value={contactName} onChange={(e) => setContactName(e.target.value)} />
          </label>
          <label>
            {copy.pro_phone}
            <input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="09…" />
          </label>
          <label>
            {copy.pro_specialty}
            <select value={specialty} onChange={(e) => setSpecialty(e.target.value)}>
              {PROFESSIONAL_SPECIALTY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {locale === 'en' ? opt.labelEn : opt.labelFa}
                </option>
              ))}
            </select>
          </label>
          <label>
            {copy.seller_city}
            <input value={city} onChange={(e) => setCity(e.target.value)} />
          </label>
          <label>
            {copy.pro_notes}
            <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
          <button className="dv-btn" type="submit" disabled={busy}>
            {copy.pro_send_lead}
          </button>
        </form>
      </section>
    </div>
  );
}
