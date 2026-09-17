'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { register } from '@/lib/auth-client';
import type { Locale } from '@/lib/i18n-public';

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
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await register({ email: email.trim(), password, fullName: fullName.trim() || undefined });
      if (intent === 'professional') router.push(`/${locale}/professionals?onboard=1`);
      else if (intent === 'seller') router.push(`/${locale}/seller?onboard=1`);
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
      <label>
        {copy.auth_full_name}
        <input value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" />
      </label>
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
      {error ? <p className="panel-err">{error}</p> : null}
      <button className="dv-btn" type="submit" disabled={busy}>
        {busy ? '…' : copy.auth_register_cta}
      </button>
      <p className="panel-muted">
        {copy.auth_have_account} <a href={`/${locale}/login`}>{copy.auth_login_cta}</a>
      </p>
    </form>
  );
}
