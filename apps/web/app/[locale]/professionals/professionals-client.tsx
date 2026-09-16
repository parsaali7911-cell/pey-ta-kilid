'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  apiAuthed,
  fetchMe,
  getAccessToken,
  type AuthUser,
} from '@/lib/auth-client';
import { apiPostClient, apiUrl } from '@/lib/api';
import type { Locale } from '@/lib/i18n-public';
import { PROFESSIONAL_SPECIALTY_OPTIONS } from '@/lib/lexicon/specialties';

type ProOrg = {
  id: string;
  name: string;
  slug: string;
  specialty?: string | null;
  specialtyLabel?: string | null;
  distanceKm?: number | null;
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
}: {
  locale: Locale;
  copy: Record<string, string>;
  onboard?: boolean;
  findMode?: boolean;
  initialSpecialty?: string;
  initialCity?: string;
}) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [directory, setDirectory] = useState<ProOrg[]>([]);
  const [orgName, setOrgName] = useState('');
  const [orgSlug, setOrgSlug] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [specialty, setSpecialty] = useState(initialSpecialty || 'installation');
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
      if (getAccessToken()) {
        try {
          setUser(await fetchMe());
        } catch {
          setUser(null);
        }
      }
    })();
  }, [locale, findMode, city, specialty]);

  async function registerProOrg(e: FormEvent) {
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
      await apiAuthed('/organizations', {
        method: 'POST',
        json: {
          name: orgName.trim(),
          slug: (orgSlug || orgName)
            .toLowerCase()
            .replace(/[^a-z0-9-]+/g, '-')
            .replace(/^-|-$/g, ''),
          canSell: true,
          canBuy: false,
          isProfessional: true,
          primarySpecialty: specialty,
          location: {
            city: city.trim(),
            countryCode: 'IR',
            line1: city.trim(),
          },
        },
      });
      setMsg(copy.pro_org_created);
      setOrgName('');
      setOrgSlug('');
      router.push(`/${locale}/seller?onboard=1&city=${encodeURIComponent(city)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  async function submitLead(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await apiPostClient('/professionals/leads', {
        contactName: contactName.trim(),
        contactEmail: contactEmail.trim() || undefined,
        contactPhone: contactPhone.trim() || undefined,
        specialtyHints: [specialty],
        city,
        countryCode: 'IR',
        notes: notes.trim() || undefined,
        sourceText: notes.trim() || specialty,
        locale,
      });
      setMsg(copy.pro_lead_sent);
      setContactName('');
      setNotes('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  const specialtySelect = (
    <select value={specialty} onChange={(e) => setSpecialty(e.target.value)}>
      {PROFESSIONAL_SPECIALTY_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {locale === 'en' ? opt.labelEn : opt.labelFa} / {opt.labelEn}
        </option>
      ))}
    </select>
  );

  return (
    <div className="panel-workspace" style={{ padding: '1rem 0 2rem' }}>
      {onboard ? <p className="panel-ok">{copy.pro_onboard_hint}</p> : null}
      {findMode ? (
        <p className="panel-ok">
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

      {findMode ? (
        <section className="panel-card" style={{ marginBottom: '1rem' }}>
          <h2>{copy.pro_directory}</h2>
          <p className="panel-muted">{copy.pro_find_directory_lead}</p>
          <ul className="panel-list">
            {directory.map((o) => (
              <li key={o.id}>
                <strong>{o.name}</strong>
                {o.specialtyLabel ? <span className="panel-muted"> · {o.specialtyLabel}</span> : null}
                {o.distanceKm != null ? (
                  <span className="panel-muted"> · {o.distanceKm.toFixed(1)} km</span>
                ) : null}
                <div className="panel-muted">
                  {o.locations
                    .map((l) =>
                      [l.name, l.city, l.province, l.latitude != null ? `${l.latitude.toFixed(3)},${l.longitude?.toFixed(3)}` : null]
                        .filter(Boolean)
                        .join(' · '),
                    )
                    .join(' | ') || '—'}
                </div>
              </li>
            ))}
          </ul>
          {!directory.length ? <p className="panel-muted">{copy.pro_directory_empty}</p> : null}
        </section>
      ) : null}

      <div className="panel-grid-2" style={{ gap: '1rem', alignItems: 'start' }}>
        <section className="panel-card">
          <h2>{copy.pro_register_title}</h2>
          <p className="panel-muted">{copy.pro_register_lead}</p>
          {!user ? (
            <p>
              <a
                className="mp-btn mp-btn--primary"
                href={`/${locale}/register?intent=professional&specialty=${encodeURIComponent(specialty)}&city=${encodeURIComponent(city)}`}
              >
                {copy.auth_register_cta}
              </a>{' '}
              <a
                className="mp-btn"
                href={`/${locale}/login?next=${encodeURIComponent(`/${locale}/professionals?onboard=1&specialty=${specialty}&city=${city}`)}`}
              >
                {copy.auth_login_cta}
              </a>
            </p>
          ) : (
            <form className="panel-form" onSubmit={registerProOrg}>
              <label>
                {copy.seller_org_name}
                <input required value={orgName} onChange={(e) => setOrgName(e.target.value)} />
              </label>
              <label>
                {copy.seller_org_slug}
                <input value={orgSlug} onChange={(e) => setOrgSlug(e.target.value)} placeholder="my-installer" />
              </label>
              <label>
                {copy.pro_specialty}
                {specialtySelect}
              </label>
              <label>
                {copy.seller_city}
                <input required value={city} onChange={(e) => setCity(e.target.value)} />
              </label>
              <button className="mp-btn mp-btn--primary" type="submit" disabled={busy}>
                {copy.pro_create_org_cta}
              </button>
            </form>
          )}
        </section>

        <section className="panel-card">
          <h2>{copy.pro_request_title}</h2>
          <p className="panel-muted">{copy.pro_request_lead}</p>
          <form className="panel-form" onSubmit={submitLead}>
            <label>
              {copy.auth_full_name}
              <input required value={contactName} onChange={(e) => setContactName(e.target.value)} />
            </label>
            <label>
              {copy.auth_email}
              <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
            </label>
            <label>
              {copy.pro_phone}
              <input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
            </label>
            <label>
              {copy.pro_specialty}
              {specialtySelect}
            </label>
            <label>
              {copy.seller_city}
              <input value={city} onChange={(e) => setCity(e.target.value)} />
            </label>
            <label>
              {copy.pro_notes}
              <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </label>
            <button className="mp-btn mp-btn--primary" type="submit" disabled={busy}>
              {copy.pro_send_lead}
            </button>
          </form>
        </section>
      </div>

      {!findMode ? (
        <section className="panel-card" style={{ marginTop: '1rem' }}>
          <h2>{copy.pro_directory}</h2>
          {!directory.length ? <p className="panel-muted">{copy.pro_directory_empty}</p> : null}
          <ul className="panel-list">
            {directory.map((o) => (
              <li key={o.id}>
                <strong>{o.name}</strong>
                {o.specialtyLabel ? ` · ${o.specialtyLabel}` : ''}
                {o.locations[0]
                  ? ` · ${o.locations[0].city || ''}${o.locations[0].province ? ', ' + o.locations[0].province : ''}`
                  : ''}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
