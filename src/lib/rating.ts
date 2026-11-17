/** One rating, kept on the completed visit. */
export type RatingResult = "ok" | "missing" | "closed" | "rated";

export const RATING_NOTE_LIMIT = 280;

/** Blank notes are stored as nothing. Anything longer is cut to the limit. */
export function cleanRatingNote(note: string | null | undefined): string | null {
  if (!note) return null;
  const trimmed = note.trim().slice(0, RATING_NOTE_LIMIT);
  return trimmed.length > 0 ? trimmed : null;
}
