'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { login } from '@/lib/auth-client';
import type { Locale } from '@/lib/i18n-public';

export function LoginClient({
  locale,
  copy,
  nextPath,
}: {
  locale: Locale;
  copy: Record<string, string>;
  nextPath?: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(email.trim(), password);
      const dest = nextPath || `/${locale}/seller`;
      router.push(dest);
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
          autoComplete="current-password"
        />
      </label>
      {error ? <p className="panel-err">{error}</p> : null}
      <button className="dv-btn" type="submit" disabled={busy}>
        {busy ? '…' : copy.auth_login_cta}
      </button>
      <p className="panel-muted">
        {copy.auth_no_account}{' '}
        <a href={`/${locale}/register`}>{copy.auth_register_cta}</a>
      </p>
    </form>
  );
}
