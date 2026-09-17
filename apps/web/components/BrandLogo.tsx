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
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="brand-logo-photo"
        src="/brand/peytakilid-mark.png"
        alt=""
        width={size}
        height={size}
        decoding="async"
        style={{
          width: size,
          height: size,
          objectFit: 'cover',
          objectPosition: 'center 20%',
          borderRadius: 12,
        }}
      />
      <span className="brand-logo-text">{label}</span>
    </a>
  );
}
