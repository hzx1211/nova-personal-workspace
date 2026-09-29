import { ApiError } from "./errors";

type Row = Record<string, unknown>;
type Args = Record<string, unknown>;
type Delegate = {
  findMany(args: Args): Promise<Row[]>;
  findFirst(args: Args): Promise<Row | null>;
  findUnique(args: Args): Promise<Row | null>;
  count(args: Args): Promise<number>;
  create(args: Args): Promise<Row>;
  update(args: Args): Promise<Row>;
  upsert(args: Args): Promise<Row>;
};

export type PrismaLike = {
  task: Delegate;
  project: Delegate;
  inboxItem: Delegate;
  calendarEvent: Delegate;
  learningDeck: Delegate;
  vocabularyWord: Delegate;
  userWordProgress: Delegate;
  reviewAttempt: Delegate;
  focusSession: Delegate;
  habit: Delegate;
  habitEntry: Delegate;
  goal: Delegate;
  notification: Delegate;
  userSettings: Delegate;
  $transaction<T>(fn: (tx: PrismaLike) => Promise<T>): Promise<T>;
};

declare global {
  // eslint-disable-next-line no-var
  var __novaPrisma: Promise<PrismaLike> | undefined;
}

/** Lazy, hot-reload-safe singleton. The package name is indirect so this source
 * typechecks even before the required Prisma runtime dependency is installed. */
export async function getPrisma(): Promise<PrismaLike> {
  if (!process.env.DATABASE_URL) {
    throw new ApiError(503, "DATABASE_UNAVAILABLE", "DATABASE_URL is not configured.");
  }

  if (!globalThis.__novaPrisma) {
    globalThis.__novaPrisma = (async () => {
      try {
        const packageName = "@prisma/client";
        const loaded: unknown = await import(packageName);
        const clientConstructor = (loaded as { PrismaClient?: new () => unknown }).PrismaClient;
        if (!clientConstructor) throw new Error("PrismaClient export is unavailable");
        return new clientConstructor() as PrismaLike;
      } catch {
        throw new ApiError(503, "DATABASE_UNAVAILABLE", "Prisma Client is unavailable; install and generate the configured Prisma Client before serving database requests.");
      }
    })();
  }
  return globalThis.__novaPrisma;
}
