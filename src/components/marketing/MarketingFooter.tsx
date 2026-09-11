import Link from "next/link";
import { Logo } from "@/components/brand/Logo";

export function MarketingFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-6 py-10 text-center">
        <Logo height={24} />
        <p className="max-w-sm text-sm text-muted-foreground">
          Upload your knowledge. Ask anything. See the evidence.
        </p>
        <div className="flex items-center gap-6 text-sm text-muted-foreground">
          <Link href="/sign-in" className="transition-colors hover:text-foreground">
            Sign in
          </Link>
        </div>
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} Retriva
        </p>
      </div>
    </footer>
  );
}
