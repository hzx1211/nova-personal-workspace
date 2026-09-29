import { withApi } from "@/lib/server/handler";
import { ApiError } from "@/lib/server/errors";
import { boundedInteger, queryUuid } from "@/lib/server/validation";
import { iso, nullableIso } from "@/lib/server/dates";

export const GET = withApi(async (request, { prisma, userId }) => {
  const search = new URL(request.url).searchParams;
  const deckId = queryUuid(search.get("deckId"), "deckId");
  const limit = boundedInteger(search.get("limit"), "limit", 20, 1, 100);
  const mode = search.get("mode") ?? "due";
  if (mode !== "due" && mode !== "new" && mode !== "mixed") {
    throw new ApiError(400, "BAD_REQUEST", "mode must be due, new, or mixed.", [{ field: "mode", message: "Use due, new, or mixed." }]);
  }
  const deck = await prisma.learningDeck.findFirst({ where: { id: deckId }, select: { id: true } });
  if (!deck) throw new ApiError(404, "NOT_FOUND", "Learning deck was not found.");

  // Vocabulary words are shared catalog content; only this user's progress is read.
  const [words, progressRows] = await Promise.all([
    prisma.vocabularyWord.findMany({ where: { deckId }, orderBy: [{ position: "asc" }, { id: "asc" }] }),
    prisma.userWordProgress.findMany({ where: { userId, word: { is: { deckId } } } }),
  ]);
  const progressByWord = new Map(progressRows.map((row) => [String(row.wordId), row]));
  const now = Date.now();
  const entries = words.map((word) => {
    const progress = progressByWord.get(String(word.id));
    const state = progress ? String(progress.state).toLowerCase() : "new";
    const dueAt = progress?.dueAt;
    return {
      wordId: word.id,
      spelling: word.spelling,
      phonetic: word.phonetic ?? null,
      definition: word.definition,
      example: word.example ?? null,
      state,
      dueAt: nullableIso(dueAt),
      reviewProgressId: progress?.id ?? null,
      position: Number(word.position ?? 0),
      isDue: Boolean(progress && dueAt && new Date(String(dueAt)).getTime() <= now),
      isNew: !progress || state === "new",
    };
  });
  const due = entries.filter((entry) => entry.isDue).sort((a, b) => new Date(String(a.dueAt)).getTime() - new Date(String(b.dueAt)).getTime() || a.position - b.position);
  const fresh = entries.filter((entry) => entry.isNew).sort((a, b) => a.position - b.position);
  const selected = mode === "due" ? due : mode === "new" ? fresh : [...due, ...fresh];
  return Response.json({
    data: {
      deckId,
      items: selected.slice(0, limit).map(({ position: _position, isDue: _isDue, isNew: _isNew, ...item }) => item),
      dueCount: due.length,
      newCount: fresh.length,
    },
  });
});
