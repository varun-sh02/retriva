import { cn } from "@/lib/utils";

export function HeroVisual({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 480 360" className={cn("w-full", className)} role="img" aria-hidden="true">
      <rect x="4" y="4" width="472" height="352" rx="20" className="fill-card stroke-border" strokeWidth="1.5" />

      <rect x="4" y="4" width="472" height="40" rx="20" className="fill-card" />
      <rect x="4" y="24" width="472" height="20" className="fill-card" />
      <line x1="4" y1="44" x2="476" y2="44" className="stroke-border" strokeWidth="1.5" />
      <circle cx="26" cy="24" r="5" className="fill-destructive/50" />
      <circle cx="42" cy="24" r="5" className="fill-brand/60" />
      <circle cx="58" cy="24" r="5" className="fill-primary/50" />
      <rect x="200" y="18" width="80" height="12" rx="6" className="fill-muted" />

      <rect x="4" y="44" width="120" height="312" className="fill-muted/40" />
      <line x1="124" y1="44" x2="124" y2="356" className="stroke-border" strokeWidth="1.5" />
      <rect x="20" y="62" width="88" height="10" rx="3" className="fill-muted-foreground/40" />
      <rect x="20" y="86" width="88" height="26" rx="8" className="fill-primary/10 stroke-primary/40" strokeWidth="1.3" />
      <rect x="30" y="94" width="60" height="6" rx="3" className="fill-primary/70" />
      <rect x="20" y="122" width="88" height="26" rx="8" className="fill-background" />
      <rect x="30" y="130" width="50" height="6" rx="3" className="fill-muted-foreground/30" />
      <rect x="20" y="158" width="88" height="26" rx="8" className="fill-background" />
      <rect x="30" y="166" width="66" height="6" rx="3" className="fill-muted-foreground/30" />

      <rect x="152" y="66" width="200" height="34" rx="16" className="fill-primary" />
      <rect x="168" y="78" width="120" height="6" rx="3" className="fill-primary-foreground/70" />
      <rect x="168" y="88" width="80" height="6" rx="3" className="fill-primary-foreground/45" />

      <rect x="148" y="114" width="288" height="90" rx="16" className="fill-background stroke-border" strokeWidth="1.5" />
      <rect x="166" y="132" width="240" height="6" rx="3" className="fill-muted-foreground/30" />
      <rect x="166" y="146" width="200" height="6" rx="3" className="fill-muted-foreground/30" />
      <rect x="166" y="160" width="150" height="6" rx="3" className="fill-muted-foreground/30" />

      <circle cx="330" cy="163" r="8" className="fill-brand/15 stroke-brand-text" strokeWidth="1.3" />
      <text x="330" y="166.5" textAnchor="middle" className="fill-brand-text text-[9px] font-semibold">1</text>
      <circle cx="349" cy="163" r="8" className="fill-brand/15 stroke-brand-text" strokeWidth="1.3" />
      <text x="349" y="166.5" textAnchor="middle" className="fill-brand-text text-[9px] font-semibold">2</text>

      <rect x="166" y="178" width="90" height="18" rx="9" className="fill-tint stroke-brand/30" strokeWidth="1.2" />
      <path d="M177 187l3.2 3.4 6-6.8" className="fill-none stroke-brand-text" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="192" y="184" width="50" height="6" rx="3" className="fill-brand-text/70" />

      <rect x="148" y="284" width="288" height="40" rx="14" className="fill-muted/60 stroke-border" strokeWidth="1.5" />
      <rect x="166" y="300" width="180" height="8" rx="4" className="fill-muted-foreground/25" />
      <circle cx="404" cy="304" r="13" className="fill-primary" />
      <path d="M404 309v-10m0 0-4.5 4.5m4.5-4.5 4.5 4.5" className="stroke-primary-foreground" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}
