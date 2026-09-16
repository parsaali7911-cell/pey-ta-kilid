'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Locale } from '@/lib/i18n-public';

export function MarketplaceNeedAdvisor({
  locale,
  copy,
}: {
  locale: Locale;
  copy: Record<string, string>;
}) {
  const router = useRouter();
  const [projectType, setProjectType] = useState('indoor');
  const [style, setStyle] = useState('modern');
  const [color, setColor] = useState('');
  const [budget, setBudget] = useState('');

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const parts = [
      copy.mp_ai_query_prefix,
      `${copy.mp_ai_project}: ${projectType === 'outdoor' ? copy.mp_ai_outdoor : copy.mp_ai_indoor}`,
      `${copy.mp_ai_style}: ${
        style === 'classic' ? copy.mp_ai_classic : style === 'minimal' ? copy.mp_ai_minimal : copy.mp_ai_modern
      }`,
      color ? `${copy.mp_ai_color_pref}: ${color}` : '',
      budget ? `${copy.mp_ai_budget}: ${budget}` : '',
    ].filter(Boolean);
    router.push(`/${locale}/search?q=${encodeURIComponent(parts.join('. '))}`);
  }

  return (
    <section className="mp-ai" aria-labelledby="mp-ai-title">
      <div className="mp-ai__inner">
        <h2 id="mp-ai-title" className="mp-section-title">
          {copy.mp_ai_title}
        </h2>
        <p className="mp-section-lead">{copy.mp_ai_lead}</p>
        <form className="mp-ai__form" onSubmit={onSubmit}>
          <label>
            {copy.mp_ai_project}
            <select value={projectType} onChange={(e) => setProjectType(e.target.value)}>
              <option value="indoor">{copy.mp_ai_indoor}</option>
              <option value="outdoor">{copy.mp_ai_outdoor}</option>
            </select>
          </label>
          <label>
            {copy.mp_ai_style}
            <select value={style} onChange={(e) => setStyle(e.target.value)}>
              <option value="modern">{copy.mp_ai_modern}</option>
              <option value="classic">{copy.mp_ai_classic}</option>
              <option value="minimal">{copy.mp_ai_minimal}</option>
            </select>
          </label>
          <label>
            {copy.mp_ai_color_pref}
            <input value={color} onChange={(e) => setColor(e.target.value)} placeholder={copy.mp_ai_color_ph} />
          </label>
          <label>
            {copy.mp_ai_budget}
            <input value={budget} onChange={(e) => setBudget(e.target.value)} placeholder={copy.mp_ai_budget_ph} />
          </label>
          <button className="mp-btn mp-btn--primary" type="submit">
            {copy.mp_ai_cta}
          </button>
        </form>
      </div>
    </section>
  );
}
