import { cn } from "@/lib/utils";

export function AskIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 180" className={cn("w-full", className)} role="img" aria-hidden="true">
      <rect width="240" height="180" rx="16" className="fill-muted" />

      <rect x="40" y="38" width="160" height="42" rx="14" className="fill-primary" />
      <rect x="56" y="53" width="90" height="5" rx="2.5" className="fill-primary-foreground/70" />
      <rect x="56" y="64" width="60" height="5" rx="2.5" className="fill-primary-foreground/50" />

      <rect x="52" y="96" width="136" height="46" rx="14" className="fill-background stroke-border" strokeWidth="1.5" />
      <rect x="68" y="110" width="70" height="5" rx="2.5" className="fill-muted-foreground/30" />
      <circle cx="146" cy="112.5" r="2.6" className="fill-primary" />
      <circle cx="156" cy="112.5" r="2.6" className="fill-primary/60" />
      <circle cx="166" cy="112.5" r="2.6" className="fill-primary/30" />
      <rect x="68" y="122" width="44" height="5" rx="2.5" className="fill-muted-foreground/30" />

      <g transform="translate(150,30)">
        <circle cx="20" cy="20" r="17" className="fill-background stroke-brand-text" strokeWidth="3" />
        <line x1="31" y1="31" x2="40" y2="40" className="stroke-brand-text" strokeWidth="3" strokeLinecap="round" />
      </g>
    </svg>
  );
}
