import "server-only";
import { getGeminiClient, withRetry } from "@/lib/gemini/client";
import { serverEnv } from "@/lib/config/server-env";

export type ImageAnalysis = {
  description: string;
  ocrText: string;
  entities: string[];
  relationships: string[];
  imageType: "diagram" | "screenshot" | "photo" | "chart" | "document_scan" | "other";
};

const IMAGE_ANALYSIS_SCHEMA = {
  type: "object",
  properties: {
    description: { type: "string" },
    ocrText: { type: "string" },
    entities: { type: "array", items: { type: "string" } },
    relationships: { type: "array", items: { type: "string" } },
    imageType: {
      type: "string",
      enum: ["diagram", "screenshot", "photo", "chart", "document_scan", "other"],
    },
  },
  required: ["description", "ocrText", "entities", "relationships", "imageType"],
};

/**
 * Structured vision analysis (docs/multimodal-ingestion.md §4). The
 * assembled text record from this is what gets embedded as text; the raw
 * image bytes are embedded separately as a native image vector
 * (state-machine wiring in TASK-048) — this module only does the
 * understanding half.
 */
export async function analyzeImage(buffer: Buffer, mimeType: string): Promise<ImageAnalysis> {
  const ai = getGeminiClient();

  const response = await withRetry(() =>
    ai.models.generateContent({
      model: serverEnv.GEMINI_MODEL,
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType, data: buffer.toString("base64") } },
            {
              text:
                "Analyze this image. Describe what it shows in prose. Transcribe any legible " +
                "text verbatim as ocrText (empty string if none). List detected entities (systems, " +
                "labels, objects, technologies named or shown). List relationships between entities " +
                "if the image shows a diagram or flow (e.g. 'Frontend -> API'). Classify the image type.",
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseJsonSchema: IMAGE_ANALYSIS_SCHEMA,
      },
    }),
  );

  const parsed = JSON.parse(response.text ?? "{}") as Partial<ImageAnalysis>;

  return {
    description: parsed.description ?? "",
    ocrText: parsed.ocrText ?? "",
    entities: Array.isArray(parsed.entities) ? parsed.entities : [],
    relationships: Array.isArray(parsed.relationships) ? parsed.relationships : [],
    imageType: parsed.imageType ?? "other",
  };
}

/** Assembled record embedded as the image's "text" vector_kind chunk. */
export function buildImageTextRecord(analysis: ImageAnalysis, documentName: string): string {
  const lines = [
    `Image: ${documentName}`,
    "",
    "Description:",
    analysis.description,
  ];

  if (analysis.ocrText) {
    lines.push("", "Text detected in image:", analysis.ocrText);
  }
  if (analysis.entities.length > 0) {
    lines.push("", "Detected entities:", analysis.entities.join(", "));
  }
  if (analysis.relationships.length > 0) {
    lines.push("", "Relationships:", analysis.relationships.join(", "));
  }

  return lines.join("\n");
}
