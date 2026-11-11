/** What a profile or session form gets back from its server action. Null before the first submit. */
export type FormState = {
  ok: boolean;
  message: string;
  /** Field name to message. */
  errors?: Record<string, string>;
  /** What was typed, so a refused form keeps it. */
  values?: Record<string, string>;
  /**
   * A session change that would remove booked visits: how many, and when. The form then offers
   * "Notify them and offer new times"; nothing changes until the doctor confirms that.
   */
  displace?: { count: number; times: string[] };
  /**
   * The session grows into the start of a neighbouring stream that has patients there: they can move
   * to its later free slots. How many, and "Name 12:00 → 12:40" lines. Nothing moves until confirmed.
   */
  shift?: { count: number; lines: string[] };
} | null;
