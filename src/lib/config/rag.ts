/** Defaults from docs/rag-pipeline.md §10. Not secrets — safe to import from anywhere. */
export const RAG_CONFIG = {
  topK: 8,
  finalContextChunks: 5,
  scoreThreshold: 0.35,
  maxChunksPerDocument: 3,
  contextTokenBudget: 12000,
  historyMessages: 10,
  summarizeAfterMessages: 20,
  rerankEnabled: false,
} as const;
