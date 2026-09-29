import { withApi } from "@/lib/server/handler";
import { ApiError } from "@/lib/server/errors";

export const GET = withApi(async (request, { prisma, userId }) => {
  const search = new URL(request.url).searchParams;
  const exam = search.get("exam");
  if (exam !== null && exam !== "CET4" && exam !== "CET6") {
    throw new ApiError(400, "BAD_REQUEST", "exam must be CET4 or CET6.", [{ field: "exam", message: "Use CET4 or CET6." }]);
  }

  // Decks/words are explicitly shared catalog models in schema.prisma; user-owned
  // progress queries below are always scoped to the authenticated user.
  const decks = await prisma.learningDeck.findMany({
    where: exam ? { exam } : {},
    orderBy: [{ exam: "asc" }, { name: "asc" }],
  });
  const now = new Date();
  const data = await Promise.all(decks.map(async (deck) => {
    const deckId = String(deck.id);
    const relation = { word: { is: { deckId } } };
    const [totalWords, dueCount, learnedCount] = await Promise.all([
      prisma.vocabularyWord.count({ where: { deckId } }),
      prisma.userWordProgress.count({ where: { userId, dueAt: { lte: now }, ...relation } }),
      prisma.userWordProgress.count({ where: { userId, state: { in: ["LEARNING", "REVIEW"] }, ...relation } }),
    ]);
    return { id: deck.id, code: deck.code, name: deck.name, exam: deck.exam, totalWords, dueCount, learnedCount };
  }));
  return Response.json({ data });
});
