"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CitationBadge } from "@/components/chat/Citation";
import type { ChatCitation } from "@/hooks/useChatStream";

const QUESTION = "How many vacation days do new hires get in their first year?";
const ANSWER =
  "New hires accrue 15 paid vacation days in their first year, prorated from their start date [SOURCE_1]. After three years of tenure this increases to 20 days per year [SOURCE_2].";

const CITATIONS: Record<string, ChatCitation> = {
  SOURCE_1: {
    sourceId: "SOURCE_1",
    chunkId: "demo-1",
    documentId: "demo-doc",
    documentName: "Employee-Handbook-2025.pdf",
    contentType: "application/pdf",
    excerpt:
      "All new hires accrue paid vacation at a rate of 1.25 days per full month worked, for a total of 15 days in their first 12 months, prorated from their official start date.",
    pageNumber: 12,
    startTimestamp: null,
    endTimestamp: null,
    sectionPath: null,
    score: 0.91,
  },
  SOURCE_2: {
    sourceId: "SOURCE_2",
    chunkId: "demo-2",
    documentId: "demo-doc",
    documentName: "Employee-Handbook-2025.pdf",
    contentType: "application/pdf",
    excerpt:
      "Once an employee has completed three full years of continuous service, their annual vacation accrual increases from 15 to 20 days per calendar year.",
    pageNumber: 13,
    startTimestamp: null,
    endTimestamp: null,
    sectionPath: null,
    score: 0.88,
  },
};

type Stage = "idle" | "typing" | "sent" | "searching" | "synthesizing" | "answering" | "done";

function renderAnswer(text: string, onOpen: (c: ChatCitation) => void) {
  const parts = text.split(/(\[SOURCE_\d+\])/g);
  return parts.map((part, i) => {
    const sourceId = /^\[(SOURCE_\d+)\]$/.exec(part)?.[1];
    if (!sourceId) return <span key={i}>{part}</span>;
    return <CitationBadge key={i} sourceId={sourceId} citation={CITATIONS[sourceId]} onOpen={onOpen} />;
  });
}

export function LiveDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [typed, setTyped] = useState("");
  const [visibleAnswer, setVisibleAnswer] = useState(0);
  const [openCitation, setOpenCitation] = useState<ChatCitation | null>(null);
  const [reducedMotion, setReducedMotion] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = () => setReducedMotion(query.matches);
    query.addEventListener("change", handler);
    return () => query.removeEventListener("change", handler);
  }, []);

  // Kicks off the scripted conversation once the demo scrolls into view —
  // the setState calls live inside the observer's own callback (not the
  // effect body) so this is a subscription, not a derived-state effect.
  useEffect(() => {
    const el = ref.current;
    if (!el || stage !== "idle") return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        observer.disconnect();
        if (reducedMotion) {
          setTyped(QUESTION);
          setVisibleAnswer(ANSWER.length);
          setStage("done");
        } else {
          setStage("typing");
        }
      },
      { threshold: 0.4 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [stage, reducedMotion]);

  useEffect(() => {
    if (stage !== "typing") return;
    if (typed.length >= QUESTION.length) {
      const t = setTimeout(() => setStage("sent"), 500);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setTyped(QUESTION.slice(0, typed.length + 1)), 28);
    return () => clearTimeout(t);
  }, [stage, typed]);

  useEffect(() => {
    if (stage === "sent") {
      const t = setTimeout(() => setStage("searching"), 700);
      return () => clearTimeout(t);
    }
    if (stage === "searching") {
      const t = setTimeout(() => setStage("synthesizing"), 1100);
      return () => clearTimeout(t);
    }
    if (stage === "synthesizing") {
      const t = setTimeout(() => setStage("answering"), 1100);
      return () => clearTimeout(t);
    }
  }, [stage]);

  useEffect(() => {
    if (stage !== "answering") return;
    if (visibleAnswer >= ANSWER.length) {
      const t = setTimeout(() => setStage("done"), 400);
      return () => clearTimeout(t);
    }
    const step = Math.min(4, ANSWER.length - visibleAnswer);
    const t = setTimeout(() => setVisibleAnswer((v) => v + step), 20);
    return () => clearTimeout(t);
  }, [stage, visibleAnswer]);

  useEffect(() => {
    if (stage !== "done" || reducedMotion) return;
    const citation = CITATIONS.SOURCE_1;
    if (!citation) return;
    const t = setTimeout(() => setOpenCitation(citation), 1200);
    return () => clearTimeout(t);
  }, [stage, reducedMotion]);

  function replay() {
    setOpenCitation(null);
    setTyped("");
    setVisibleAnswer(0);
    setStage("typing");
  }

  const showUserMessage = stage !== "idle" && stage !== "typing";
  const phaseLabel =
    stage === "searching" ? "Searching your knowledge…" : stage === "synthesizing" ? "Synthesizing evidence…" : null;

  return (
    <div ref={ref} className="overflow-hidden rounded-2xl border bg-card">
      <div className="flex h-11 shrink-0 items-center justify-between border-b px-4">
        <span className="text-sm font-medium text-muted-foreground">HR Handbook</span>
        <Button variant="ghost" size="icon-sm" aria-label="Replay demo" onClick={replay}>
          <RotateCcw className="size-3.5" />
        </Button>
      </div>

      <div className="min-h-[220px] p-4">
        <div className="flex flex-col gap-4">
          {stage === "typing" && typed.length === 0 && (
            <p className="text-sm text-muted-foreground">Ask anything about this knowledge base.</p>
          )}

          {showUserMessage && (
            <div className="ml-auto max-w-[80%] animate-in fade-in slide-in-from-bottom-1 rounded-2xl bg-primary px-4 py-2 text-sm text-primary-foreground duration-300">
              {QUESTION}
            </div>
          )}

          {phaseLabel && <p className="text-sm text-muted-foreground">{phaseLabel}</p>}

          {(stage === "answering" || stage === "done") && (
            <div className="max-w-[85%] animate-in fade-in slide-in-from-bottom-1 duration-300">
              <div className="prose prose-sm dark:prose-invert max-w-none [&_p]:my-1">
                <p>
                  {renderAnswer(ANSWER.slice(0, visibleAnswer), setOpenCitation)}
                  {stage === "answering" && <span className="animate-pulse">▍</span>}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-end gap-2 border-t p-3">
        <Textarea
          value={typed}
          readOnly
          placeholder="Ask a question…"
          rows={1}
          className="max-h-32 min-h-9 w-full resize-none"
        />
        <Button type="button" size="icon" disabled aria-label="Send">
          <ArrowUp className="size-4" />
        </Button>
      </div>

      <Sheet open={openCitation !== null} onOpenChange={(open) => !open && setOpenCitation(null)}>
        <SheetContent side="right" className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{openCitation?.documentName}</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-4 px-4 pb-4">
            <p className="text-sm text-muted-foreground">Page {openCitation?.pageNumber}</p>
            <blockquote className="rounded-md border-l-2 border-brand bg-tint py-2 pl-3 text-sm whitespace-pre-wrap text-tint-foreground">
              {openCitation?.excerpt}
            </blockquote>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
