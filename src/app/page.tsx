import type { Metadata } from "next";
import Link from "next/link";
import {
  BadgeCheck,
  Code2,
  Layers,
  MessagesSquare,
  ShieldCheck,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { HeroVisual } from "@/components/marketing/HeroVisual";
import { LiveDemo } from "@/components/marketing/LiveDemo";
import { UploadIllustration } from "@/components/marketing/illustrations/UploadIllustration";
import { AskIllustration } from "@/components/marketing/illustrations/AskIllustration";
import { CiteIllustration } from "@/components/marketing/illustrations/CiteIllustration";

const description =
  "Upload PDFs, docs, images, and video. Retriva turns them into a chat assistant that answers your questions and always shows exactly where the answer came from.";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: "Retriva — Chat with your knowledge, grounded in real citations",
  description,
  openGraph: {
    title: "Retriva — Chat with your knowledge, grounded in real citations",
    description,
    images: ["/marketing/demo-poster.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Retriva — Chat with your knowledge, grounded in real citations",
    description,
    images: ["/marketing/demo-poster.png"],
  },
};

const FEATURES: { icon: LucideIcon; title: string; description: string }[] = [
  {
    icon: Layers,
    title: "Every modality, one pipeline",
    description:
      "PDF, DOCX, TXT/MD, images, and video all ingest through the same resumable pipeline — Gemini vision for pages and images, timestamped transcripts for video.",
  },
  {
    icon: BadgeCheck,
    title: "Answers grounded in your content",
    description:
      "Every answer traces back to the exact chunk, page, or timestamp it came from — filenames and locations always come from your documents, never the model.",
  },
  {
    icon: MessagesSquare,
    title: "Real conversations, real memory",
    description:
      "The assistant keeps the last 10 turns verbatim plus a rolling summary beyond that, so long conversations don't lose the thread.",
  },
  {
    icon: Zap,
    title: "Streamed, not stalled",
    description: "Answers stream in as they're generated, so you're reading from the first word — never staring at a blank screen.",
  },
  {
    icon: Code2,
    title: "Drop it into your own site",
    description:
      "Turn any knowledge base into an embeddable chat widget with one script tag on your own page — no iframe wrangling, no CORS headaches.",
  },
  {
    icon: ShieldCheck,
    title: "Your data stays yours",
    description: "Every workspace is isolated end to end — row-level security plus an explicit server-side check on every query, with per-workspace rate limits.",
  },
];

const STEPS: { illustration: typeof UploadIllustration; title: string; description: string }[] = [
  {
    illustration: UploadIllustration,
    title: "Upload your content",
    description: "Drag in PDFs, docs, images, or video. Retriva extracts, chunks, and embeds it automatically — no manual tagging.",
  },
  {
    illustration: AskIllustration,
    title: "Ask a question",
    description: "Type it like you would to a coworker. Retriva searches your knowledge base and starts synthesizing an answer in seconds.",
  },
  {
    illustration: CiteIllustration,
    title: "Get a grounded answer",
    description: "Every answer comes with citations back to the exact source, so you can verify it instead of just trusting it.",
  },
];

export default function MarketingHomePage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <MarketingNav />

      <main className="flex-1">
        <section className="mx-auto grid max-w-6xl gap-12 px-6 pt-16 pb-20 md:grid-cols-2 md:items-center md:pt-24">
          <div className="flex flex-col items-start gap-6">
            <h1 className="text-4xl leading-[1.1] font-bold tracking-[-0.045em] text-balance md:text-5xl">
              Ask your knowledge base anything.{" "}
              <span className="text-brand-text">Get answers you can verify.</span>
            </h1>
            <p className="max-w-md text-lg text-muted-foreground">
              Upload PDFs, docs, images, and video. Retriva turns them into a chat assistant that
              answers in seconds and always shows exactly which source it came from.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                size="lg"
                className="h-10 px-5 text-base"
                nativeButton={false}
                render={<Link href="/sign-in">Get started free</Link>}
              />
              <Button
                size="lg"
                variant="outline"
                className="h-10 px-5 text-base"
                nativeButton={false}
                render={<a href="#how-it-works">See how it works</a>}
              />
            </div>
          </div>

          <HeroVisual className="drop-shadow-xl" />
        </section>

        <section id="features" className="border-t bg-muted/30">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-[-0.045em]">
                Built for answers you can trust
              </h2>
              <p className="mt-3 text-muted-foreground">
                Everything Retriva does is designed around one idea: an answer is only useful if you can check where it came from.
              </p>
            </div>

            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(({ icon: Icon, title, description }) => (
                <Card key={title}>
                  <CardContent className="flex flex-col gap-3">
                    <div className="flex size-10 items-center justify-center rounded-lg bg-tint">
                      <Icon className="size-5 text-brand-text" />
                    </div>
                    <h3 className="font-medium">{title}</h3>
                    <p className="text-sm text-muted-foreground">{description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section id="how-it-works" className="mx-auto max-w-6xl px-6 py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-[-0.045em]">
              How it works
            </h2>
            <p className="mt-3 text-muted-foreground">From raw files to a grounded answer, in three steps.</p>
          </div>

          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {STEPS.map(({ illustration: Illustration, title, description }, index) => (
              <div key={title} className="flex flex-col gap-4">
                <Illustration />
                <div className="flex items-start gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                    {index + 1}
                  </span>
                  <div>
                    <h3 className="font-medium">{title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mx-auto mt-16 max-w-lg">
            <LiveDemo />
          </div>
        </section>

        <section className="border-t bg-muted/30">
          <div className="mx-auto max-w-4xl px-6 py-20">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-[-0.045em]">
                Prefer to just watch?
              </h2>
              <p className="mt-3 text-muted-foreground">
                Upload, ask, and get a grounded answer back — the whole pipeline in under 15 seconds.
              </p>
            </div>

            <div className="mt-10 overflow-hidden rounded-2xl border bg-card">
              <video
                className="aspect-video w-full bg-muted"
                controls
                preload="metadata"
                poster="/marketing/demo-poster.png"
              >
                <source src="/marketing/demo.webm" type="video/webm" />
                <source src="/marketing/demo.mp4" type="video/mp4" />
                Your browser doesn&apos;t support embedded video — the steps above walk through the same flow.
              </video>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 pb-24">
          <div className="flex flex-col items-center gap-6 rounded-2xl bg-brand px-8 py-16 text-center text-brand-foreground">
            <h2 className="text-3xl font-bold tracking-[-0.045em]">
              Turn your documents into answers
            </h2>
            <p className="max-w-md text-brand-foreground/80">
              Create a knowledge base, upload your first file, and ask your first question in under five minutes.
            </p>
            <Button
              size="lg"
              variant="secondary"
              className="h-10 px-5 text-base"
              nativeButton={false}
              render={<Link href="/sign-in">Get started free</Link>}
            />
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
