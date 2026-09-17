'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  apiAuthed,
  fetchMe,
  getAccessToken,
} from '@/lib/auth-client';
import type { Locale } from '@/lib/i18n-public';

type OrgMem = {
  organization: { id: string; name: string; canBuy?: boolean };
};

type ProjectListItem = {
  id: string;
  publicId: string;
  name: string;
  projectTypeCode?: string | null;
  city?: string | null;
  currentStageLabel?: string | null;
  progressPct: number;
  status: string;
  estimatedCompletionDate?: string | null;
  openProcurementCount: number;
};

export default function ProjectsClient({
  locale,
  copy,
}: {
  locale: Locale;
  copy: Record<string, string>;
}) {
  const router = useRouter();
  const [items, setItems] = useState<ProjectListItem[]>([]);
  const [orgId, setOrgId] = useState('');
  const [name, setName] = useState('');
  const [city, setCity] = useState('Tehran');
  const [projectType, setProjectType] = useState('villa');
  const [areaM2, setAreaM2] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    if (!getAccessToken()) return;
    const list = await apiAuthed<ProjectListItem[]>(`/projects?locale=${locale}`);
    setItems(Array.isArray(list) ? list : []);
  }

  useEffect(() => {
    void (async () => {
      if (!getAccessToken()) return;
      try {
        await fetchMe();
        const orgs = await apiAuthed<OrgMem[]>('/organizations');
        const buy = (orgs || []).find((o) => o.organization.canBuy !== false);
        if (buy) setOrgId(buy.organization.id);
        else {
          const me = await fetchMe();
          const slugBase = (me.email.split('@')[0] || 'buyer')
            .toLowerCase()
            .replace(/[^a-z0-9-]+/g, '-')
            .slice(0, 20);
          const org = await apiAuthed<{ id: string }>('/organizations', {
            method: 'POST',
            json: {
              name: me.fullName || me.email || 'Buyer',
              slug: `${slugBase}-buyer-${Date.now().toString(36).slice(-4)}`,
              canBuy: true,
              canSell: false,
              isProfessional: false,
            },
          });
          setOrgId(org.id);
        }
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed');
      }
    })();
  }, [locale]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!getAccessToken()) {
      router.push(`/${locale}/login?next=${encodeURIComponent(`/${locale}/projects`)}`);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const ws = await apiAuthed<{ id: string }>(`/projects?locale=${locale}`, {
        method: 'POST',
        json: {
          ownerOrganizationId: orgId,
          name: name.trim(),
          projectTypeCode: projectType,
          city: city.trim() || undefined,
          areaM2: areaM2 ? Number(areaM2) : undefined,
        },
      });
      router.push(`/${locale}/projects/${ws.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  if (!getAccessToken()) {
    return (
      <div className="panel-workspace" style={{ padding: '1rem' }}>
        <h1>{copy.nav_projects}</h1>
        <p className="panel-muted">{copy.proj_login_required}</p>
        <a className="mp-btn mp-btn--primary" href={`/${locale}/login?next=/${locale}/projects`}>
          {copy.auth_login_cta}
        </a>
      </div>
    );
  }

  return (
    <div className="panel-workspace" style={{ padding: '1rem 0 2rem' }}>
      <header className="panel-header" style={{ marginBottom: '1rem' }}>
        <div className="panel-header__brand">
          <h1>{copy.nav_projects}</h1>
          <p>{copy.proj_list_lead}</p>
        </div>
      </header>

      {error ? <p className="panel-err">{error}</p> : null}

      <div className="panel-grid-2" style={{ gap: '1rem', alignItems: 'start' }}>
        <section className="panel-card">
          <h2>{copy.proj_create_title}</h2>
          <form className="panel-form" onSubmit={onCreate}>
            <label>
              {copy.proj_name}
              <input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
            </label>
            <label>
              {copy.proj_type}
              <select value={projectType} onChange={(e) => setProjectType(e.target.value)}>
                <option value="villa">{copy.proj_type_villa}</option>
                <option value="apartment">{copy.proj_type_apartment}</option>
                <option value="office">{copy.proj_type_office}</option>
                <option value="renovation">{copy.proj_type_renovation}</option>
                <option value="other">{copy.proj_type_other}</option>
              </select>
            </label>
            <label>
              {copy.proj_city}
              <input value={city} onChange={(e) => setCity(e.target.value)} />
            </label>
            <label>
              {copy.proj_area}
              <input
                type="number"
                min={0}
                value={areaM2}
                onChange={(e) => setAreaM2(e.target.value)}
                placeholder="m²"
              />
            </label>
            <button className="mp-btn mp-btn--primary" type="submit" disabled={busy || !orgId}>
              {copy.proj_create_cta}
            </button>
          </form>
        </section>

        <section className="panel-card">
          <h2>{copy.proj_your_projects}</h2>
          {!items.length ? <p className="panel-muted">{copy.proj_empty}</p> : null}
          <ul className="panel-list">
            {items.map((p) => (
              <li key={p.id}>
                <a href={`/${locale}/projects/${p.id}`}>
                  <strong>{p.name}</strong>
                </a>
                <div className="panel-muted">
                  {[p.city, p.currentStageLabel, `${p.progressPct}%`].filter(Boolean).join(' · ')}
                  {p.openProcurementCount
                    ? ` · ${p.openProcurementCount} ${copy.proj_open_items}`
                    : ''}
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
