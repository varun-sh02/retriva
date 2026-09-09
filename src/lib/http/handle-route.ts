import "server-only";
import { ApiError } from "./api-error";

/**
 * Wraps a route handler body so every route gets consistent error shaping
 * (docs/api-contracts.md §1) without repeating a try/catch in each file.
 * Thrown ApiErrors become their intended status/code; anything else becomes
 * a generic 500 with a correlation ID — the full error is logged
 * server-side under that ID, never sent to the browser (docs/security.md).
 */
export async function handleRoute(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof ApiError) {
      return error.toResponse();
    }

    const correlationId = crypto.randomUUID();
    console.error(`[${correlationId}]`, error);
    return Response.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Something went wrong.",
          correlationId,
        },
      },
      { status: 500 },
    );
  }
}
