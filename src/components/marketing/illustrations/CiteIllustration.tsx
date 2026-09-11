import { cn } from "@/lib/utils";

export function CiteIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 180" className={cn("w-full", className)} role="img" aria-hidden="true">
      <rect width="240" height="180" rx="16" className="fill-muted" />

      <rect x="36" y="28" width="168" height="66" rx="14" className="fill-background stroke-border" strokeWidth="1.5" />
      <rect x="52" y="44" width="120" height="5" rx="2.5" className="fill-muted-foreground/30" />
      <rect x="52" y="55" width="100" height="5" rx="2.5" className="fill-muted-foreground/30" />
      <rect x="52" y="66" width="70" height="5" rx="2.5" className="fill-muted-foreground/30" />
      <circle cx="130" cy="68.5" r="6.5" className="fill-primary/10 stroke-primary" strokeWidth="1.3" />
      <text x="130" y="71.5" textAnchor="middle" className="fill-primary text-[8px] font-semibold">1</text>
      <circle cx="146" cy="68.5" r="6.5" className="fill-primary/10 stroke-primary" strokeWidth="1.3" />
      <text x="146" y="71.5" textAnchor="middle" className="fill-primary text-[8px] font-semibold">2</text>

      <line x1="130" y1="75" x2="72" y2="122" className="stroke-brand/50" strokeWidth="1.5" strokeDasharray="3 4" />
      <line x1="146" y1="75" x2="166" y2="122" className="stroke-brand/50" strokeWidth="1.5" strokeDasharray="3 4" />

      <g transform="translate(44,122)">
        <rect x="0" y="0" width="56" height="34" rx="8" className="fill-background stroke-border" strokeWidth="1.5" />
        <rect x="10" y="8" width="36" height="4" rx="2" className="fill-muted-foreground/30" />
        <rect x="10" y="16" width="24" height="4" rx="2" className="fill-muted-foreground/30" />
        <circle cx="46" cy="10" r="5" className="fill-brand" />
        <path d="M43.5 10l1.7 1.8 3.3-3.6" className="fill-none stroke-background" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </g>

      <g transform="translate(138,122)">
        <rect x="0" y="0" width="56" height="34" rx="8" className="fill-background stroke-border" strokeWidth="1.5" />
        <rect x="10" y="8" width="36" height="4" rx="2" className="fill-muted-foreground/30" />
        <rect x="10" y="16" width="24" height="4" rx="2" className="fill-muted-foreground/30" />
        <circle cx="46" cy="10" r="5" className="fill-brand" />
        <path d="M43.5 10l1.7 1.8 3.3-3.6" className="fill-none stroke-background" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}
