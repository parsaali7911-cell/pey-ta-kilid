import type { ReactNode } from 'react';

export function PublicPageShell({
  locale,
  kicker,
  title,
  lead,
  children,
  wide,
}: {
  locale: string;
  kicker?: string;
  title: string;
  lead?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="panel-workspace public-workspace" lang={locale}>
      <header className="panel-header">
        <div className="panel-header__brand">
          {kicker ? <p className="public-kicker">{kicker}</p> : null}
          <h1 className="panel-title">{title}</h1>
          {lead ? <p className="panel-lead">{lead}</p> : null}
        </div>
      </header>
      <div className="public-main">
        <div className={wide ? 'public-main-wide' : 'panel-main-card'}>{children}</div>
      </div>
    </div>
  );
}
