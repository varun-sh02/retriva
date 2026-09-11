import { cn } from "@/lib/utils";

export function UploadIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 180" className={cn("w-full", className)} aria-hidden="true" focusable="false">
      <rect width="240" height="180" rx="16" className="fill-muted" />

      <rect
        x="46"
        y="34"
        width="148"
        height="118"
        rx="12"
        className="fill-none stroke-primary/35"
        strokeWidth="2"
        strokeDasharray="6 6"
      />

      <g transform="translate(70,86) rotate(-8)">
        <rect x="0" y="0" width="46" height="58" rx="6" className="fill-background stroke-border" strokeWidth="1.5" />
        <rect x="0" y="0" width="46" height="12" rx="6" className="fill-primary" />
        <rect x="8" y="24" width="30" height="4" rx="2" className="fill-muted-foreground/30" />
        <rect x="8" y="34" width="30" height="4" rx="2" className="fill-muted-foreground/30" />
        <rect x="8" y="44" width="18" height="4" rx="2" className="fill-muted-foreground/30" />
      </g>

      <g transform="translate(112,74)">
        <rect x="0" y="0" width="46" height="58" rx="6" className="fill-background stroke-border" strokeWidth="1.5" />
        <rect x="0" y="0" width="46" height="12" rx="6" className="fill-brand" />
        <circle cx="23" cy="36" r="10" className="fill-none stroke-muted-foreground/30" strokeWidth="2" />
        <path d="M18 36l4 4 8-9" className="fill-none stroke-muted-foreground/40" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </g>

      <g transform="translate(148,90) rotate(7)">
        <rect x="0" y="0" width="40" height="52" rx="6" className="fill-background stroke-border" strokeWidth="1.5" />
        <rect x="0" y="0" width="40" height="12" rx="6" className="fill-muted-foreground/50" />
        <path d="M8 24l6 20M20 24l0 20M32 24l-6 20" className="stroke-muted-foreground/30" strokeWidth="2" strokeLinecap="round" />
      </g>

      <circle cx="120" cy="40" r="16" className="fill-primary" />
      <path
        d="M120 46v-12m0 0-6 6m6-6 6 6"
        className="stroke-primary-foreground"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
