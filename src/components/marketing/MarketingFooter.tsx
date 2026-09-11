import Link from "next/link";

const LINKS: { label: string; href: string }[] = [
  { label: "How it works", href: "/#how-it-works" },
  { label: "Evidence", href: "/#evidence" },
  { label: "Sign in", href: "/sign-in" },
];

/**
 * The oversized wordmark that anchors the footer.
 *
 * SVG rather than CSS type because the width has to be exact: brand type is
 * Helvetica Neue, a *system* font that falls back to Arial off macOS
 * (docs/design-system.md §10), so any `font-size: Nvw` guess that fills the
 * width on one platform overflows or under-fills on another. `textLength`
 * pins the rendered width to the viewBox regardless of which font resolves,
 * and the viewBox is proportioned to the natural advance width so the glyph
 * correction is a percent or two — invisible at 6% opacity.
 *
 * The viewBox height is the cap height, so the box crops tight to the letters
 * with no dead space above or below.
 */
function FooterWordmark() {
  return (
    <svg
      viewBox="0 0 490 74"
      preserveAspectRatio="xMidYMax meet"
      className="block w-full text-foreground"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="retriva-footer-wordmark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.09" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.028" />
        </linearGradient>
      </defs>
      <text
        x="0"
        y="74"
        textLength="490"
        lengthAdjust="spacingAndGlyphs"
        fontSize="100"
        fontWeight="700"
        className="font-sans"
        fill="url(#retriva-footer-wordmark)"
      >
        RETRIVA
      </text>
    </svg>
  );
}

export function MarketingFooter() {
  return (
    <footer>
      <div className="mx-auto max-w-6xl px-6">
        <FooterWordmark />

        {/*
          Three zones on one line — identity, navigation, legal — separated by
          a hairline rather than stacked and centred. Centred footers give
          every item the same weight; a real product footer has a reading
          order.
        */}
        <div className="mt-8 flex flex-col gap-8 border-t pt-6 pb-10 md:flex-row md:items-start md:justify-between md:gap-12">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-bold tracking-[0.14em] uppercase">Retriva</span>
            <span className="text-sm text-muted-foreground">
              Every answer, traced to the source.
            </span>
          </div>

          <nav aria-label="Footer" className="flex flex-wrap gap-x-8 gap-y-2">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-sm text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* ml-auto rather than relying on justify-between alone: with three
              items of very different widths, justify-between alone lets the
              nav drift up against the copyright. */}
          <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase md:ml-auto">
            © {new Date().getFullYear()} Retriva. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
