import { randomUUID } from "node:crypto";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly errors?: Array<{ field: string; message: string }>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function problemResponse(error: ApiError, request: Request): Response {
  const body = {
    type: `https://api.nova.example/problems/${error.code.toLowerCase().replaceAll("_", "-")}`,
    title: error.status >= 500 ? "Service unavailable" : error.status === 401 ? "Unauthorized" : error.status === 404 ? "Not found" : error.status === 422 ? "Validation failed" : "Bad request",
    status: error.status,
    detail: error.message,
    code: error.code,
    ...(error.errors ? { errors: error.errors } : {}),
    requestId: randomUUID(),
  };
  return Response.json(body, {
    status: error.status,
    headers: { "content-type": "application/problem+json; charset=utf-8" },
  });
}

export function unexpectedProblem(request: Request): Response {
  return problemResponse(new ApiError(500, "INTERNAL_SERVER_ERROR", "An unexpected server error occurred."), request);
}
