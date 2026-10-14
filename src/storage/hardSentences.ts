// "My hard sentences" on the practice page (decision 29): starred sentences, by sentence ID.
import type { SqlDb } from "./db";

export async function hardSentenceIds(db: SqlDb): Promise<string[]> {
  const rows = await db.select<{ sentence_id: string }[]>(
    "SELECT sentence_id FROM hard_sentences ORDER BY created_at, sentence_id",
  );
  return rows.map((r) => r.sentence_id);
}

export async function setHardSentence(db: SqlDb, sentenceId: string, hard: boolean): Promise<void> {
  if (hard)
    await db.execute(
      "INSERT INTO hard_sentences (sentence_id, created_at) VALUES ($1, $2) ON CONFLICT(sentence_id) DO NOTHING",
      [sentenceId, new Date().toISOString()],
    );
  else await db.execute("DELETE FROM hard_sentences WHERE sentence_id = $1", [sentenceId]);
}
