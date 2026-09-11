import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";

export function MarketingNav() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-6">
        <Link href="/" aria-label="Retriva home">
          <Logo height={28} />
        </Link>

        <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
          <a href="#how-it-works" className="transition-colors hover:text-foreground">
            How it works
          </a>
          <a href="#evidence" className="transition-colors hover:text-foreground">
            Evidence
          </a>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/sign-in">Sign in</Link>} />
          <Button size="sm" nativeButton={false} render={<Link href="/sign-in">Get started</Link>} />
        </div>
      </div>
    </header>
  );
}
