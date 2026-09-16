export function BrandLogo({
  href,
  className = '',
  size = 44,
  label = 'پی تا کلید',
}: {
  href: string;
  className?: string;
  size?: number;
  label?: string;
}) {
  return (
    <a href={href} className={`brand-logo ${className}`.trim()} aria-label={label}>
      <span
        className="brand-logo-img"
        style={{
          width: size,
          height: size,
          borderRadius: 12,
          display: 'grid',
          placeItems: 'center',
          background: 'linear-gradient(145deg, #2a6b5c, #1e4a40)',
          color: '#fff',
          fontSize: Math.max(11, Math.round(size * 0.28)),
          fontWeight: 700,
          letterSpacing: '0.02em',
        }}
        aria-hidden
      >
        PK
      </span>
      <span className="brand-logo-text">{label}</span>
    </a>
  );
}
