/** The Lectoire mark — same artwork as app/icon.svg, for in-app use. */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label="Lectoire">
      <rect width="64" height="64" rx="14" fill="#1c1917" />
      {/* An L whose stem is a page; the amber triangle is its turned-down corner. */}
      <path d="M17 12H22L28 18V41H47V52H17Z" fill="#f7f6f3" />
      <path d="M22 12H28V18Z" fill="#b45309" />
    </svg>
  );
}
