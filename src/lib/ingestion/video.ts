import "server-only";
import { MediaResolution } from "@google/genai";
import { getGeminiClient, withRetry } from "@/lib/gemini/client";
import { serverEnv } from "@/lib/config/server-env";

export type RawVideoSegment = {
  startSeconds?: number;
  endSeconds?: number;
  title?: string;
  transcript?: string;
  visualContext?: string;
  speakers?: string[];
};

const SEGMENTATION_SCHEMA = {
  type: "object",
  properties: {
    segments: {
      type: "array",
      items: {
        type: "object",
        properties: {
          startSeconds: { type: "number" },
          endSeconds: { type: "number" },
          title: { type: "string" },
          transcript: { type: "string" },
          visualContext: { type: "string" },
          speakers: { type: "array", items: { type: "string" } },
        },
        required: ["startSeconds", "endSeconds", "transcript"],
      },
    },
  },
  required: ["segments"],
};

/**
 * Timestamped semantic segmentation (docs/multimodal-ingestion.md §5).
 * The model's own timestamps are hints only — video-validate.ts bounds-checks
 * every segment against the container's real duration before anything here
 * is trusted for a citation.
 */
export async function segmentVideo(fileUri: string, mimeType: string): Promise<RawVideoSegment[]> {
  const ai = getGeminiClient();

  const prompt = [
    "Segment this video by topic shift, not fixed intervals. Keep segments between 30 and 120 seconds.",
    "Transcribe spoken content verbatim for each segment. Describe what is visually on screen only if it",
    "carries meaning (e.g. a slide, a diagram, on-screen text). Cover the entire video with no gaps.",
    "Never invent timestamps — they must reflect what you actually observe in the video.",
  ].join(" ");

  const response = await withRetry(() =>
    ai.models.generateContent({
      model: serverEnv.GEMINI_MODEL,
      contents: [
        {
          role: "user",
          parts: [
            { fileData: { fileUri, mimeType } },
            { text: prompt },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseJsonSchema: SEGMENTATION_SCHEMA,
        // Low resolution is deliberate here: this is meeting/screen-recording
        // content where speech and slide text matter, not fine visual
        // detail, and it keeps token use and latency down
        // (docs/multimodal-ingestion.md §5).
        mediaResolution: MediaResolution.MEDIA_RESOLUTION_LOW,
      },
    }),
  );

  const parsed = JSON.parse(response.text ?? "{}") as { segments?: RawVideoSegment[] };
  return Array.isArray(parsed.segments) ? parsed.segments : [];
}
