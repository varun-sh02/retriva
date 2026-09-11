import { headers } from "next/headers";

/**
 * Where this deployment actually lives.
 *
 * `NEXT_PUBLIC_APP_URL` is baked into the bundle at build time, so it is only
 * ever as correct as whatever was typed into the environment — and the value
 * people copy out of `.env.example` is `http://localhost:3000`. Left that way
 * on Vercel it silently produces localhost links in production, which is
 * exactly the failure this module exists to prevent.
 */

const LOCALHOST = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;

function isLocal(url: string | undefined): boolean {
  return !url || LOCALHOST.test(url.replace(/\/$/, ""));
}

/**
 * Build-time origin, for the places that cannot see a request — `metadata`
 * exports, most importantly `metadataBase` for Open Graph image URLs.
 *
 * Prefers Vercel's own production URL over a configured localhost, because on
 * Vercel a localhost value is always a leftover rather than an intention.
 */
export function configuredAppUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  const vercelProduction = process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL;
  const vercelDeployment = process.env.NEXT_PUBLIC_VERCEL_URL;

  if (isLocal(configured)) {
    if (vercelProduction) return `https://${vercelProduction}`;
    if (vercelDeployment) return `https://${vercelDeployment}`;
  }

  return configured ?? "http://localhost:3000";
}

/**
 * The origin the user is looking at *right now*, read from the request.
 *
 * This is what the embed snippet must be built from. It is correct on a
 * custom domain, on `*.vercel.app`, and on every preview deployment — none of
 * which a build-time environment variable can distinguish between. Vercel
 * terminates TLS at the edge and forwards `x-forwarded-*`, so the proxy
 * headers are checked first.
 *
 * Only ever used in Server Components rendering a page the owner requested,
 * so there is no untrusted-host concern: the value is echoed back into the
 * owner's own UI, never used to build a server-side request or a redirect.
 */
export async function requestOrigin(): Promise<string> {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");

  if (!host) return configuredAppUrl();

  const proto =
    headerList.get("x-forwarded-proto") ??
    (/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(host) ? "http" : "https");

  return `${proto}://${host}`;
}
