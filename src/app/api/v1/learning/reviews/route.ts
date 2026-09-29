import { withApi } from "@/lib/server/handler";
import { ApiError } from "@/lib/server/errors";
import type { PrismaLike } from "@/lib/server/prisma";
import { enumValue, readJsonObject, uuid } from "@/lib/server/validation";
import type { Row } from "@/lib/server/mappers";

const ANSWERS = ["again", "hard", "good", "easy"] as const;
type Answer = (typeof ANSWERS)[number];

type ReviewInput = { wordId: string; clientAttemptId: string; answer: Answer; responseMs: number };
function asAnswer(value: unknown): Answer {
  return enumValue(value, "answer", ANSWERS);
}
function resultFromAttempt(attempt: Row) {
  const reviewedAt = new Date(String(attempt.reviewedAt));
  const intervalDays = Number(attempt.intervalDays);
  return {
    attemptId: attempt.id,
    wordId: attempt.wordId,
    answer: String(attempt.answer).toLowerCase(),
    correct: Boolean(attempt.correct),
    nextDueAt: new Date(reviewedAt.getTime() + intervalDays * 86_400_000).toISOString(),
    intervalDays,
    repetitions: Number(attempt.repetitions),
    reviewedAt: reviewedAt.toISOString(),
  };
}
function samePayload(attempt: Row, input: ReviewInput): boolean {
  return String(attempt.wordId) === input.wordId
    && String(attempt.answer).toLowerCase() === input.answer
    && Number(attempt.responseMs) === input.responseMs;
}
function conflict(): never {
  throw new ApiError(409, "IDEMPOTENCY_CONFLICT", "clientAttemptId has already been used with a different review payload.");
}
function nextProgress(answer: Answer, previous?: Row) {
  const oldRepetitions = Number(previous?.repetitions ?? 0);
  const oldInterval = Number(previous?.intervalDays ?? 0);
  const oldEase = Number(previous?.easeFactor ?? 2.5);
  let intervalDays: number;
  let repetitions: number;
  let easeFactor = oldEase;
  let lapses = Number(previous?.lapses ?? 0);
  let state: "LEARNING" | "REVIEW";

  if (answer === "again") {
    intervalDays = 1;
    repetitions = 0;
    easeFactor = Math.max(1.3, oldEase - 0.2);
    lapses += 1;
    state = "LEARNING";
  } else if (answer === "hard") {
    intervalDays = oldRepetitions === 0 ? 1 : Math.max(1, oldInterval * 1.2);
    repetitions = oldRepetitions + 1;
    easeFactor = Math.max(1.3, oldEase - 0.15);
    state = repetitions >= 3 ? "REVIEW" : "LEARNING";
  } else if (answer === "good") {
    intervalDays = oldRepetitions === 0 ? 1 : oldRepetitions === 1 ? 6 : Math.max(1, oldInterval * oldEase);
    repetitions = oldRepetitions + 1;
    state = repetitions >= 3 ? "REVIEW" : "LEARNING";
  } else {
    intervalDays = oldRepetitions === 0 ? 4 : Math.max(1, oldInterval * oldEase * 1.3);
    repetitions = oldRepetitions + 1;
    easeFactor = oldEase + 0.15;
    state = "REVIEW";
  }
  return { intervalDays, repetitions, easeFactor, lapses, state };
}

export const POST = withApi(async (request, { prisma, userId }) => {
  const body = await readJsonObject(request, ["wordId", "clientAttemptId", "answer", "responseMs"]);
  const input: ReviewInput = {
    wordId: uuid(body.wordId, "wordId"),
    clientAttemptId: uuid(body.clientAttemptId, "clientAttemptId"),
    answer: asAnswer(body.answer),
    responseMs: Number(body.responseMs),
  };
  if (!Number.isInteger(body.responseMs) || input.responseMs < 0 || input.responseMs > 3_600_000) {
    throw new ApiError(422, "VALIDATION_ERROR", "responseMs must be an integer between 0 and 3600000.", [{ field: "responseMs", message: "responseMs must be between 0 and 3600000." }]);
  }

  const existing = await prisma.reviewAttempt.findFirst({ where: { userId, clientAttemptId: input.clientAttemptId } });
  if (existing) {
    if (!samePayload(existing, input)) conflict();
    return Response.json({ data: resultFromAttempt(existing) }, { status: 200 });
  }
  const word = await prisma.vocabularyWord.findFirst({ where: { id: input.wordId }, select: { id: true } });
  if (!word) throw new ApiError(404, "NOT_FOUND", "Vocabulary word was not found.");

  const reviewedAt = new Date();
  let transactionResult: { attempt: Row; replayed: boolean };
  try {
    transactionResult = await prisma.$transaction(async (tx: PrismaLike) => {
      const replay = await tx.reviewAttempt.findFirst({ where: { userId, clientAttemptId: input.clientAttemptId } });
      if (replay) {
        if (!samePayload(replay, input)) conflict();
        return { attempt: replay, replayed: true };
      }
      const previous = await tx.userWordProgress.findFirst({ where: { userId, wordId: input.wordId } });
      const next = nextProgress(input.answer, previous ?? undefined);
      await tx.userWordProgress.upsert({
        where: { userId_wordId: { userId, wordId: input.wordId } },
        create: {
          userId,
          wordId: input.wordId,
          state: next.state,
          dueAt: new Date(reviewedAt.getTime() + next.intervalDays * 86_400_000),
          lastReviewedAt: reviewedAt,
          intervalDays: next.intervalDays,
          easeFactor: next.easeFactor,
          repetitions: next.repetitions,
          lapses: next.lapses,
        },
        update: {
          state: next.state,
          dueAt: new Date(reviewedAt.getTime() + next.intervalDays * 86_400_000),
          lastReviewedAt: reviewedAt,
          intervalDays: next.intervalDays,
          easeFactor: next.easeFactor,
          repetitions: next.repetitions,
          lapses: next.lapses,
        },
      });
      // The schema has no answer-key/prompt-mode fields. `correct` therefore
      // records the available self-rating threshold (anything except AGAIN).
      const attempt = await tx.reviewAttempt.create({
        data: {
          userId,
          wordId: input.wordId,
          clientAttemptId: input.clientAttemptId,
          answer: input.answer.toUpperCase(),
          correct: input.answer !== "again",
          responseMs: input.responseMs,
          intervalDays: next.intervalDays,
          repetitions: next.repetitions,
          reviewedAt,
        },
      });
      return { attempt, replayed: false };
    });
  } catch (error) {
    // A concurrent replay may race the unique(userId, clientAttemptId) insert.
    const replay = await prisma.reviewAttempt.findFirst({ where: { userId, clientAttemptId: input.clientAttemptId } });
    if (!replay) throw error;
    if (!samePayload(replay, input)) conflict();
    return Response.json({ data: resultFromAttempt(replay) }, { status: 200 });
  }
  return Response.json({ data: resultFromAttempt(transactionResult.attempt) }, { status: transactionResult.replayed ? 200 : 201 });
});
