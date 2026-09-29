import { requireUserId } from "./auth";
import { ApiError, problemResponse, unexpectedProblem } from "./errors";
import { getPrisma, type PrismaLike } from "./prisma";

export type ApiContext = { userId: string; prisma: PrismaLike };
export type ApiOperation = (request: Request, context: ApiContext) => Promise<Response>;

export function withApi(operation: ApiOperation) {
  return async function route(request: Request): Promise<Response> {
    try {
      if (!process.env.DATABASE_URL) {
        throw new ApiError(503, "DATABASE_UNAVAILABLE", "DATABASE_URL is not configured.");
      }
      const userId = await requireUserId(request);
      const prisma = await getPrisma();
      return await operation(request, { userId, prisma });
    } catch (error) {
      if (error instanceof ApiError) return problemResponse(error, request);
      return unexpectedProblem(request);
    }
  };
}
