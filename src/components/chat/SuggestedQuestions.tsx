"use client";

/**
 * Deliberately quiet (docs/design-system.md §5.7): these are an offer, not a
 * call to action, and must not out-shout the composer. They exist to answer
 * "what can I even ask?" — the question every empty chat leaves hanging.
 */
export function SuggestedQuestions({
  questions,
  onSelect,
}: {
  questions: string[];
  onSelect: (question: string) => void;
}) {
  if (questions.length === 0) return null;

  return (
    <div className="flex w-full max-w-md flex-col gap-1.5">
      <p className="text-xs text-muted-foreground">Try asking</p>
      <ul className="flex flex-col gap-1.5">
        {questions.map((question) => (
          <li key={question}>
            <button
              type="button"
              onClick={() => onSelect(question)}
              className="w-full cursor-pointer rounded-lg border px-3 py-2 text-left text-sm transition-colors hover:bg-accent focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              {question}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
