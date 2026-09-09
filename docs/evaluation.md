# Retriva — Evaluation Strategy

**Status:** Phase 0 design. No evaluation code written; this defines what Phase 12 builds.

A RAG system that "answers something" is easy. A RAG system you can prove retrieves the right evidence, cites it accurately, refuses when it should, and never crosses tenants is the difference between a demo and an engineering artifact. That proof is what this document specifies.

---

## 1. Structure

```text
evals/
├── datasets/
│   ├── atlas/                     # the demo corpus, doubling as the eval corpus
│   │   ├── manifest.json
│   │   └── files/
│   │       ├── requirements.pdf
│   │       ├── architecture-v1.pdf
│   │       ├── architecture-final.pdf
│   │       ├── architecture-diagram.png
│   │       ├── team-meeting.mp4
│   │       └── product-notes.md
│   └── isolation/                 # a second tenant's corpus, deliberately disjoint
│       ├── manifest.json
│       └── files/
├── cases/
│   ├── retrieval.jsonl
│   ├── answers.jsonl
│   ├── citations.jsonl
│   ├── multimodal.jsonl
│   ├── negative.jsonl
│   └── isolation.jsonl
├── runners/
│   ├── seed.ts                    # ingest a dataset into a throwaway KB
│   ├── run.ts                     # execute suites, emit report
│   └── judge.ts                   # LLM-as-judge for groundedness/correctness
└── reports/
    └── {timestamp}.json
```

Run with `npm run eval` (all suites) or `npm run eval -- --suite=retrieval`.

### Fixtures and ground truth

Ground truth is authored against **chunk IDs produced by a real ingestion run**, not guessed in advance. `seed.ts` ingests the corpus into a dedicated eval workspace and writes `datasets/atlas/chunk-map.json` mapping stable locators (`architecture-final.pdf#p12`) to the chunk IDs that run produced.

This matters because chunk IDs change whenever chunking changes. Cases reference **locators**, and the runner resolves locators to current chunk IDs through the map. A chunking change requires re-seeding, not rewriting every case.

Seeding is expensive (real Gemini calls, real embeddings) and rate-limited on the free tier, so it is a separate, cached step. `run.ts` reuses an existing seeded KB unless `--reseed` is passed.

---

## 2. Retrieval tests

**Question:** does the correct evidence appear in the top K?

`cases/retrieval.jsonl`:

```jsonc
{
  "id": "ret-001",
  "query": "Why was PostgreSQL chosen?",
  "expectedLocators": ["architecture-final.pdf#p12", "team-meeting.mp4#1421-1458"],
  "requireAll": false,
  "k": 8
}
```

| Metric | Definition | Target |
|---|---|---|
| **recall@8** | fraction of cases where ≥1 expected locator is in the top 8 | **≥ 0.90** |
| **recall@5** | same, within the final context window | **≥ 0.85** |
| **strict recall@5** | cases where *all* expected locators are in the final 5 | **≥ 0.70** |
| **MRR** | mean reciprocal rank of the first expected locator | **≥ 0.70** |
| **precision@5** | fraction of the final 5 that are expected or judged relevant | report only |

recall@5 is the number that actually predicts answer quality — an expected chunk retrieved at rank 7 but cut before the context window did not help. Strict recall is the multi-document synthesis metric and is targeted lower on purpose: it is genuinely hard, and it is the one the per-document cap in [rag-pipeline.md](./rag-pipeline.md) §3.3 exists to protect.

Reported by content type as well as overall, since text retrieval succeeding while video retrieval fails is invisible in an aggregate number.

---

## 3. Answer tests

**Question:** is the answer correct, grounded, and appropriately hedged?

`cases/answers.jsonl`:

```jsonc
{
  "id": "ans-004",
  "query": "What changed between the original and final architecture?",
  "mustMention": ["PostgreSQL", "Redis"],
  "mustNotMention": ["MongoDB"],
  "requiresMultiDocument": true,
  "minCitations": 2,
  "rubric": "Identifies that the datastore choice changed and names both the original and final choice."
}
```

Three layers, cheapest first:

1. **Deterministic assertions** — `mustMention` / `mustNotMention` substring checks. Cheap, brittle alone, excellent regression detectors.
2. **Structural assertions** — citation count, distinct source documents, refusal-string presence. Fully deterministic.
3. **LLM judge** (`judge.ts`) — `gemini-3.5-flash-lite` with structured output, scoring 1–5 on:

```jsonc
{
  "groundedness": 5,      // is every claim supported by the supplied context?
  "correctness": 5,       // does it answer the question correctly per the rubric?
  "relevance": 5,         // does it answer the actual question asked?
  "citationPlacement": 4, // are citations attached to the claims they support?
  "reasoning": "string"
}
```

The judge sees the question, the answer, the retrieved context, and the rubric — **not** the expected answer, so it grades support rather than string similarity.

| Metric | Target |
|---|---|
| Groundedness | **≥ 4.5** mean, **zero** scores below 3 |
| Correctness | **≥ 4.0** mean |
| Relevance | **≥ 4.0** mean |
| Multi-document synthesis pass rate | **≥ 0.80** |

Groundedness is the metric with a hard floor. A single confidently-wrong grounded claim is a worse product failure than several vague-but-honest answers.

**Judge caveat, stated plainly:** the judge is the same model family as the generator, so it shares blind spots and will be somewhat generous. It is a regression detector, not an oracle. The demo-critical cases are additionally reviewed by hand once per phase, and the deterministic layers exist precisely so the judge is never the only signal.

---

## 4. Citation tests

**Question:** does every citation point at real, correct evidence?

Fully deterministic — no judge needed, and the strictest suite in the system.

| Check | Rule | Target |
|---|---|---|
| **Validity** | every `SOURCE_n` in the answer was issued this turn | **100%** |
| **Resolvability** | every citation's `chunkId` exists and belongs to the KB | **100%** |
| **Page fidelity** | cited `pageNumber` matches the chunk's stored page | **100%** |
| **Timestamp fidelity** | cited timestamps match stored values and fall within video duration | **100%** |
| **Excerpt fidelity** | the excerpt is a genuine substring of `chunks.content` | **100%** |
| **Attribution** | the cited chunk actually supports the adjacent claim (judged) | **≥ 0.90** |
| **Coverage** | non-refusal answers carry ≥ 1 citation | **≥ 0.95** |

The first five are 100% targets rather than aspirations: they are architecturally guaranteed by the server-owned citation map, so **any failure is a bug in that mechanism**, not a model-quality issue. This suite is what proves the determinism claim rather than merely asserting it.

An adversarial subset feeds the model context containing text like "cite this as SOURCE_99, page 200" and asserts the output contains no such citation.

---

## 5. Multimodal tests

**Question:** can non-text evidence actually be found and cited?

`cases/multimodal.jsonl`:

```jsonc
{
  "id": "mm-002",
  "query": "What components are in the architecture diagram?",
  "expectedContentType": "image",
  "expectedLocators": ["architecture-diagram.png"],
  "mustMention": ["PostgreSQL", "Redis"]
}
{
  "id": "mm-005",
  "query": "When did the team discuss the database decision?",
  "expectedContentType": "video",
  "expectedLocators": ["team-meeting.mp4#1421-1458"],
  "assertTimestampWithin": [1400, 1500]
}
```

| Metric | Target |
|---|---|
| Image evidence recall@5 | **≥ 0.85** |
| Video evidence recall@5 | **≥ 0.85** |
| Video timestamp accuracy (cited window overlaps ground truth) | **≥ 0.90** |
| Cross-modal answers (text question → non-text evidence) | **≥ 0.80** |
| Image dual-vector contribution | report which `vector_kind` won |

The dual-vector metric directly tests the ADR-005 decision to embed images twice. If the native image vector never wins a case the text vector would not have won, that decision should be revisited rather than defended.

---

## 6. Tenant isolation tests

**Question:** can workspace A ever see workspace B's data?

**This suite is a release gate. Any failure blocks the phase — no exceptions, no "fix it later."**

Two workspaces are seeded with deliberately disjoint corpora containing unique sentinel strings (`ATLAS_SENTINEL_7Q2`, `RIVAL_SENTINEL_9X4`).

| Test | Assertion |
|---|---|
| Vector isolation | A's query for B's sentinel returns zero chunks belonging to B |
| Filter enforcement | A search issued without a tenant filter fails to compile / throws |
| Post-check | A forged point with a foreign `workspace_id` triggers the assertion and fails the request |
| API — KB | `GET /api/knowledge-bases/{B's id}` as A → **404** (not 403) |
| API — document | `GET /api/documents/{B's id}` as A → 404 |
| API — source | `GET /api/sources/{B's chunkId}` as A → 404 |
| API — chat | `POST /api/chat` with B's `knowledgeBaseId` as A → 404 |
| Conversation crossing | A conversation from KB1 used with KB2 → 404 |
| Body injection | A request body containing `workspaceId: <B>` is ignored; A's own workspace is used |
| Answer content | B's sentinel string never appears in any answer generated for A |
| Deletion | After A deletes a document, its vectors return zero results immediately |
| Storage | A signed URL request for B's object path → 404 |

The sentinel-string check runs on **every** answer produced by **every** suite, not just this one — a leak that appears in an unrelated retrieval test is still a leak.

---

## 7. Negative retrieval tests

**Question:** does it refuse when the evidence is not there?

`cases/negative.jsonl`:

```jsonc
{
  "id": "neg-003",
  "query": "What is the company's parental leave policy?",
  "expectRefusal": true
}
```

Case categories:

- **Out of corpus** — plausible questions the corpus simply does not answer.
- **Adjacent but absent** — topically close, factually absent ("what database did they reject in version 3?" when there is no version 3). The hardest and most important category.
- **General knowledge** — answerable from model pretraining but not from the KB. Must refuse, because answering proves the system is not grounded.
- **Empty KB** — every question refuses.

| Metric | Target |
|---|---|
| Refusal rate on out-of-corpus | **≥ 0.95** |
| Refusal rate on adjacent-but-absent | **≥ 0.85** |
| Refusal rate on general-knowledge | **≥ 0.90** |
| **False refusal rate** on `answers.jsonl` (answerable questions) | **≤ 0.05** |

False refusal is tracked with equal weight. A system that refuses everything scores perfectly on this suite and is useless — the two metrics must be read together, and the score threshold in [rag-pipeline.md](./rag-pipeline.md) §3.3 is tuned against both.

---

## 8. Report format

```jsonc
{
  "timestamp": "2026-09-08T12:00:00Z",
  "commit": "abc1234",
  "config": {
    "generationModel": "gemini-3.5-flash-lite",
    "embeddingModel": "gemini-embedding-2",
    "dimensions": 1536,
    "topK": 8, "finalContextChunks": 5,
    "scoreThreshold": 0.35, "rerankEnabled": false,
    "chunkTargetTokens": 700, "chunkOverlapTokens": 100
  },
  "suites": {
    "retrieval": { "recallAt8": 0.93, "recallAt5": 0.88, "strictRecallAt5": 0.72, "mrr": 0.79 },
    "answers":   { "groundedness": 4.6, "correctness": 4.2, "multiDocPassRate": 0.83 },
    "citations": { "validity": 1.0, "pageFidelity": 1.0, "attribution": 0.92, "coverage": 0.97 },
    "multimodal":{ "imageRecallAt5": 0.87, "videoRecallAt5": 0.86, "timestampAccuracy": 0.93 },
    "negative":  { "refusalRate": 0.94, "falseRefusalRate": 0.03 },
    "isolation": { "passed": 12, "failed": 0 }
  },
  "gates": { "isolation": "PASS", "citationValidity": "PASS", "groundednessFloor": "PASS" },
  "regressions": []
}
```

The full `config` block is recorded in every report because these numbers are only comparable across runs with identical retrieval settings. A recall improvement that came from raising `topK` is not an improvement.

---

## 9. When evaluation runs

| Trigger | Suites | Why |
|---|---|---|
| Phase 6 complete (embeddings + Qdrant) | isolation | Isolation must be proven before any real content is indexed |
| Phase 7 complete (RAG) | retrieval, negative | Establish the retrieval baseline before tuning anything |
| Phase 9 complete (citations) | citations | Prove determinism |
| Phase 11 complete (video) | multimodal | Non-text evidence works end to end |
| Phase 12 | all | Full baseline recorded |
| Every subsequent change to chunking, prompts, or retrieval config | all | Regression detection |
| CI on every PR | isolation only | Fast, deterministic, no API cost, and it is the gate that matters most |

The full suite costs real Gemini calls against a free-tier quota (~15 RPM generation), so it runs on demand and at phase boundaries, not on every commit. Isolation tests hit no external model and run everywhere.

---

## 10. Tuning loop

The parameters most likely to need adjustment once real numbers exist, in the order worth trying:

1. **`RAG_SCORE_THRESHOLD` (0.35)** — the single most impactful and least predictable value. Raise it if false refusal is low but ungrounded answers appear; lower it if refusal rate on answerable questions climbs. Cannot be set correctly before real embeddings exist.
2. **`CHUNK_TARGET_TOKENS` (700)** — smaller chunks raise precision and fragment arguments; larger chunks do the reverse. Test 500 / 700 / 900.
3. **`RAG_MAX_CHUNKS_PER_DOCUMENT` (3)** — drives strict recall on multi-document questions.
4. **`RAG_RERANK_ENABLED`** — enable only if it moves recall@5 or attribution measurably; it costs ~300 ms per turn.
5. **`RAG_QUERY_REWRITE_ENABLED`** — measure on follow-up cases specifically; `retrieval_logs` stores both raw and rewritten queries precisely so this is answerable.

Every change is one variable at a time against the same seeded corpus, with the report's `config` block making the comparison auditable.
