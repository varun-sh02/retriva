import type { Metadata } from "next";
import Link from "next/link";
import { configuredAppUrl } from "@/lib/config/app-url";
import { Button } from "@/components/ui/button";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { LiveDemo } from "@/components/marketing/LiveDemo";
import { FragmentedSources } from "@/components/marketing/FragmentedSources";
import { MultimodalConverge } from "@/components/marketing/MultimodalConverge";
import { CrossSourceAnswer } from "@/components/marketing/CrossSourceAnswer";
import { SourceChip } from "@/components/chat/SourceChip";
import { UploadIllustration } from "@/components/marketing/illustrations/UploadIllustration";
import { AskIllustration } from "@/components/marketing/illustrations/AskIllustration";
import { CiteIllustration } from "@/components/marketing/illustrations/CiteIllustration";

const description =
  "Ask questions across your documents, images, and recordings. Every answer points back to the exact page, frame, or moment it came from.";

const title = "Retriva — Every answer, traced to the source";

export const metadata: Metadata = {
  metadataBase: new URL(configuredAppUrl()),
  title,
  description,
  openGraph: { title, description, images: ["/marketing/demo-poster.png"] },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/marketing/demo-poster.png"],
  },
};

const STEPS: { illustration: typeof UploadIllustration; title: string; description: string }[] = [
  {
    illustration: UploadIllustration,
    title: "Add your knowledge",
    description:
      "Drop in documents, images, and recordings. Retriva reads each one and makes it answerable. Nothing to tag, sort, or restructure.",
  },
  {
    illustration: AskIllustration,
    title: "Ask",
    description:
      "Ask the way you'd ask a colleague who had read everything. Answers stream back in seconds, drawn from across every source.",
  },
  {
    illustration: CiteIllustration,
    title: "Check",
    description:
      "Every claim carries a citation. Open it and you're looking at the original passage — the page in the PDF, the moment in the recording, the image itself.",
  },
];

const EVIDENCE_EXAMPLES = [
  { documentName: "Architecture-final.pdf", contentType: "pdf", pageNumber: 12, startTimestamp: null },
  { documentName: "Team-meeting.mp4", contentType: "video", pageNumber: null, startTimestamp: 1421 },
  {
    documentName: "Architecture-diagram.png",
    contentType: "image",
    pageNumber: null,
    startTimestamp: null,
  },
];

const USE_CASES = [
  {
    title: "Project memory",
    description:
      "The specs, the decisions, the diagram, and the call where it was settled — in one place that answers “why is it like this?” without three people reconstructing it from memory.",
  },
  {
    title: "Client work",
    description:
      "Everything a client sent you, in whatever format they sent it, answerable — and citable back to their own documents when you deliver.",
  },
  {
    title: "Research",
    description:
      "Papers, figures, and recorded interviews in one body of material. Every finding traces to the page or the minute it came from.",
  },
];

export default function MarketingHomePage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <MarketingNav />

      <main className="flex-1">
        {/* HERO — the live demo is the hero visual. Nothing we could draw
            communicates the product better than watching it answer and cite. */}
        <section className="mx-auto grid max-w-6xl gap-10 px-6 pt-16 pb-20 md:grid-cols-2 md:items-center md:pt-24">
          <div className="flex flex-col items-start gap-6">
            <h1 className="text-4xl leading-[1.1] font-bold tracking-[-0.045em] text-balance md:text-5xl">
              Every answer, <span className="text-brand-text">traced to the source.</span>
            </h1>
            <p className="max-w-md text-lg text-muted-foreground">
              Retriva turns your documents, images, and recordings into a knowledge base you can ask
              questions in plain language. Every answer points back to the exact page, frame, or
              moment behind it.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                size="lg"
                className="h-10 px-5 text-base"
                nativeButton={false}
                render={<Link href="/sign-in">Start with your knowledge</Link>}
              />
              <Button
                size="lg"
                variant="outline"
                className="h-10 px-5 text-base"
                nativeButton={false}
                render={<a href="#evidence">See it work</a>}
              />
            </div>
          </div>

          <LiveDemo />
        </section>

        {/* PROBLEM */}
        <section className="border-t bg-muted/30">
          <div className="mx-auto max-w-4xl px-6 py-20">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-[-0.045em] text-balance">
                Everything you need is already written down. Somewhere.
              </h2>
            </div>

            <div className="mt-10">
              <FragmentedSources />
            </div>

            <p className="mx-auto mt-10 max-w-xl text-center text-muted-foreground">
              Each of these is findable on its own. The answer you actually need — what changed, and
              why — isn&apos;t in any one of them. It&apos;s spread across all six, in four different
              formats, and one of them is a recording nobody is going to rewatch.
            </p>
            <p className="mt-4 text-center text-lg font-medium">
              Retriva reads all of it as one body of knowledge.
            </p>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section id="how-it-works" className="mx-auto max-w-6xl px-6 py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-[-0.045em]">Three steps.</h2>
          </div>

          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {STEPS.map(({ illustration: Illustration, title: stepTitle, description: stepBody }, index) => (
              <div key={stepTitle} className="flex flex-col gap-4">
                <Illustration />
                <div className="flex items-start gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary font-mono text-xs font-semibold text-primary-foreground tabular-nums">
                    {index + 1}
                  </span>
                  <div>
                    <h3 className="font-medium">{stepTitle}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{stepBody}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* MULTIMODAL */}
        <section className="border-t bg-muted/30">
          <div className="mx-auto max-w-4xl px-6 py-20">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-[-0.045em] text-balance">
                Your knowledge isn&apos;t all text. Your answers shouldn&apos;t be either.
              </h2>
              <p className="mt-3 text-muted-foreground">
                A specification, a whiteboard photo, an hour of recorded planning, and a notes file
                are four different formats and one subject. Retriva reads all four and answers from
                all four.
              </p>
            </div>

            <div className="mx-auto mt-10 max-w-2xl">
              <MultimodalConverge />
            </div>

            <p className="mx-auto mt-10 max-w-xl text-center text-sm text-muted-foreground">
              Diagrams are read, not just stored: Retriva can retrieve an image by what it depicts.
              Recordings keep their timeline, so an answer can point at 23:41 rather than at the
              file.
            </p>
          </div>
        </section>

        {/* EVIDENCE — the differentiator, and the centre of gravity of the page. */}
        <section id="evidence" className="mx-auto max-w-4xl px-6 py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-[-0.045em] text-balance">
              The model writes the answer. Retriva decides what it&apos;s allowed to cite.
            </h2>
            <p className="mt-4 text-muted-foreground">
              Every source shown to you is looked up in your own knowledge base by our server —
              filename, page, and timestamp included. The language model only ever supplies a
              number. If it refers to a source it wasn&apos;t given, that reference is removed
              before it reaches you.
            </p>
          </div>

          <ul className="mt-10 flex flex-wrap items-center justify-center gap-2">
            {EVIDENCE_EXAMPLES.map((source) => (
              <li key={source.documentName}>
                <SourceChip source={source} />
              </li>
            ))}
          </ul>

          <p className="mx-auto mt-10 max-w-xl text-center text-muted-foreground">
            That&apos;s why a Retriva citation is worth clicking. It isn&apos;t the model&apos;s
            recollection of where something came from. It&apos;s a lookup in your own material.
          </p>

          <p className="mx-auto mt-6 max-w-xl rounded-xl border bg-card px-5 py-4 text-center text-muted-foreground">
            And when your knowledge base doesn&apos;t have the answer, Retriva says so — instead of
            writing something plausible.
          </p>
        </section>

        {/* CROSS-SOURCE */}
        <section className="border-t bg-muted/30">
          <div className="mx-auto max-w-4xl px-6 py-20">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-[-0.045em]">
                The questions you can&apos;t answer with search
              </h2>
              <p className="mt-3 text-muted-foreground">
                There is no document that answers this. The <em>what</em> is the difference between
                two PDFs and a diagram. The <em>why</em> was said out loud in a planning call and
                written down once, in a notes file, by someone in a hurry.
              </p>
            </div>

            <div className="mx-auto mt-10 max-w-2xl">
              <CrossSourceAnswer />
            </div>
          </div>
        </section>

        {/* USE CASES */}
        <section className="mx-auto max-w-6xl px-6 py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-[-0.045em]">What people use it for</h2>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {USE_CASES.map((useCase) => (
              <div key={useCase.title} className="flex flex-col gap-2 border-t pt-4">
                <h3 className="font-medium">{useCase.title}</h3>
                <p className="text-sm text-muted-foreground">{useCase.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="mx-auto max-w-6xl px-6 pb-24">
          <div className="flex flex-col items-center gap-6 rounded-2xl bg-brand px-8 py-16 text-center text-brand-foreground">
            <h2 className="text-3xl font-bold tracking-[-0.045em] text-balance">
              Add one document. Ask one question.
            </h2>
            <p className="max-w-md text-brand-foreground/80">
              That&apos;s the whole evaluation. You&apos;ll know within five minutes whether Retriva
              knows your material better than your search bar does.
            </p>
            <Button
              size="lg"
              variant="secondary"
              className="h-10 px-5 text-base"
              nativeButton={false}
              render={<Link href="/sign-in">Start with your knowledge</Link>}
            />
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
