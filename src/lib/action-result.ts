/** What an admin action reports back to its form. Null before the first submit. */
export type ActionResult = { ok: boolean; message: string } | null;
