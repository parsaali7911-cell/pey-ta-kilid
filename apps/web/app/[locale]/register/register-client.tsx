'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { register } from '@/lib/auth-client';
import type { Locale } from '@/lib/i18n-public';
import { LocationMapPicker, type MapLocationValue } from '@/components/LocationMapPicker';

function isValidIranNationalId(raw: string): boolean {
  const code = raw.replace(/\D/g, '');
  if (!/^\d{10}$/.test(code)) return false;
  if (/^(\d)\1{9}$/.test(code)) return false;
  const check = Number(code[9]);
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(code[i]) * (10 - i);
  const r = sum % 11;
  return (r < 2 && check === r) || (r >= 2 && check === 11 - r);
}

export function RegisterClient({
  locale,
  copy,
  intent = 'seller',
}: {
  locale: Locale;
  copy: Record<string, string>;
  intent?: 'seller' | 'professional' | 'buyer';
}) {
  const router = useRouter();
  const isSeller = intent === 'seller';
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mapLoc, setMapLoc] = useState<MapLocationValue | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (isSeller) {
        if (!firstName.trim() || !lastName.trim()) {
          setError(copy.auth_need_name || 'نام و نام‌خانوادگی لازم است');
          setBusy(false);
          return;
        }
        if (!isValidIranNationalId(nationalId)) {
          setError(copy.auth_need_national_id || 'کد ملی معتبر نیست');
          setBusy(false);
          return;
        }
        if (!mapLoc) {
          setError(copy.auth_need_location || 'موقعیت را روی نقشه مشخص کنید');
          setBusy(false);
          return;
        }
      }

      const name = isSeller
        ? `${firstName.trim()} ${lastName.trim()}`.trim()
        : fullName.trim() || undefined;

      await register({
        email: email.trim(),
        password,
        fullName: name,
        firstName: isSeller ? firstName.trim() : undefined,
        lastName: isSeller ? lastName.trim() : undefined,
        nationalId: isSeller ? nationalId.replace(/\D/g, '') : undefined,
      });

      if (isSeller && mapLoc) {
        try {
          sessionStorage.setItem(
            'peytakilid:seller_onboard_location',
            JSON.stringify(mapLoc),
          );
          sessionStorage.setItem(
            'peytakilid:seller_onboard_profile',
            JSON.stringify({
              firstName: firstName.trim(),
              lastName: lastName.trim(),
              nationalId: nationalId.replace(/\D/g, ''),
            }),
          );
        } catch {
          /* ignore */
        }
      }

      if (intent === 'professional') router.push(`/${locale}/professionals?onboard=1`);
      else if (intent === 'seller') router.push(`/${locale}/seller?onboard=1&tab=facility`);
      else if (intent === 'buyer') router.push(`/${locale}/buyer?tab=org`);
      else router.push(`/${locale}/catalog`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.auth_failed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="dv-form" onSubmit={onSubmit}>
      {isSeller ? (
        <>
          <div className="panel-grid-2">
            <label>
              {copy.auth_first_name || 'نام'}
              <input required value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" />
            </label>
            <label>
              {copy.auth_last_name || 'نام خانوادگی'}
              <input required value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" />
            </label>
          </div>
          <label>
            {copy.auth_national_id || 'کد ملی'}
            <input
              required
              inputMode="numeric"
              maxLength={10}
              value={nationalId}
              onChange={(e) => setNationalId(e.target.value.replace(/\D/g, '').slice(0, 10))}
              autoComplete="off"
            />
          </label>
        </>
      ) : (
        <label>
          {copy.auth_full_name}
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" />
        </label>
      )}

      <label>
        {copy.auth_email}
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
      </label>
      <label>
        {copy.auth_password}
        <input
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
        />
      </label>

      {isSeller ? (
        <div className="dv-register-map">
          <strong>{copy.auth_register_location || 'ثبت موقعیت'}</strong>
          <LocationMapPicker value={mapLoc} onChange={setMapLoc} copy={copy} height={240} />
        </div>
      ) : null}

      {error ? <p className="panel-err">{error}</p> : null}
      <button className="dv-btn dv-btn--block" type="submit" disabled={busy}>
        {busy ? '…' : copy.auth_register_cta}
      </button>
      <p className="panel-muted">
        {copy.auth_have_account} <a href={`/${locale}/login`}>{copy.auth_login_cta}</a>
      </p>
    </form>
  );
}
