/**
 * Shared API error envelope — docs/api-contracts.md §1 (Error envelope).
 * Route handlers throw these; a top-level catch converts them with
 * `.toResponse()`. Never leak details beyond `message`/`details` to the
 * browser — stack traces and upstream error bodies are logged server-side
 * only (docs/security.md).
 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }

  toResponse(): Response {
    return Response.json(
      {
        error: {
          code: this.code,
          message: this.message,
          ...(this.details !== undefined ? { details: this.details } : {}),
        },
      },
      { status: this.status },
    );
  }
}

export function unauthorized(message = "Authentication required"): ApiError {
  return new ApiError(401, "UNAUTHORIZED", message);
}

export function notFound(message = "Not found"): ApiError {
  return new ApiError(404, "NOT_FOUND", message);
}

export function badRequest(message: string, details?: unknown): ApiError {
  return new ApiError(400, "BAD_REQUEST", message, details);
}

export function conflict(code: string, message: string): ApiError {
  return new ApiError(409, code, message);
}

export function payloadTooLarge(message: string): ApiError {
  return new ApiError(413, "FILE_TOO_LARGE", message);
}

export function unsupportedMediaType(message: string): ApiError {
  return new ApiError(415, "UNSUPPORTED_MIME", message);
}
