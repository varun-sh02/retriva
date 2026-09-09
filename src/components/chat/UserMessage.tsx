export function UserMessage({ content }: { content: string }) {
  return (
    <div className="ml-auto max-w-[80%] animate-in fade-in slide-in-from-bottom-1 rounded-2xl bg-primary px-4 py-2 text-sm text-primary-foreground duration-300">
      {content}
    </div>
  );
}
