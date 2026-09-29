import { ApiError } from "./errors";

/**
 * Authentication integration is intentionally fail-closed. The current Prisma
 * schema has no session/token model and the app has no trusted session reader
 * or issuer. Do not infer identity from request parameters or headers. Replace
 * this boundary only when an application-owned, cryptographically verified
 * session integration is configured.
 */
export async function requireUserId(_request: Request): Promise<string> {
  throw new ApiError(
    401,
    "AUTH_NOT_CONFIGURED",
    "No authenticated server session is configured for this application.",
  );
}
