import Link from "next/link";

const ITEMS = [
  { href: "/", label: "Tallea" },
  { href: "/pulse", label: "Pulse" },
  { href: "/timeline", label: "Timeline" },
  { href: "/admin", label: "Admin" },
];

export function SiteNav() {
  return (
    <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-sm border-b hairline">
      <nav className="mx-auto max-w-6xl px-6 h-12 flex items-center justify-between">
        <Link
          href="/"
          className="font-display text-base tracking-[-0.01em] text-foreground hover:opacity-80 transition-opacity"
        >
          Tallea
        </Link>
        <ul className="flex items-center gap-6">
          {ITEMS.slice(1).map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="text-[13px] text-muted hover:text-foreground transition-colors"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
