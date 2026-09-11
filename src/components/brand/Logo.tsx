import { cn } from "@/lib/utils";

/**
 * Renders both the light- and dark-ground variant of a brand asset and lets
 * CSS (the `.dark` class next-themes sets on <html>, present before paint)
 * pick the right one — no theme hook, no client component, no hydration
 * mismatch. See public/brand's README for the underlying rules (do not
 * recolor, rotate, or otherwise alter these files).
 */
function ThemedAsset({
  light,
  dark,
  alt,
  className,
}: {
  light: string;
  dark: string;
  alt: string;
  className?: string;
}) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={light} alt={alt} className={cn(className, "dark:hidden")} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={dark} alt={alt} className={cn(className, "hidden dark:block")} />
    </>
  );
}

// Intrinsic aspect ratio of the lockup SVG, so callers only need to set height.
const LOCKUP_RATIO = 236 / 48;

export function LogoMark({ className, size = 24 }: { className?: string; size?: number }) {
  return (
    <span className={cn("inline-block align-middle", className)} style={{ width: size, height: size }}>
      <ThemedAsset
        light="/brand/mark-light.svg"
        dark="/brand/mark-dark.svg"
        alt="Retriva"
        className="size-full object-contain"
      />
    </span>
  );
}

export function Logo({ className, height = 24 }: { className?: string; height?: number }) {
  return (
    <span
      className={cn("inline-block align-middle", className)}
      style={{ height, width: height * LOCKUP_RATIO }}
    >
      <ThemedAsset
        light="/brand/lockup-light.svg"
        dark="/brand/lockup-dark.svg"
        alt="Retriva"
        className="size-full object-contain"
      />
    </span>
  );
}
