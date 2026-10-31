/** What a profile or session form gets back from its server action. Null before the first submit. */
export type FormState = {
  ok: boolean;
  message: string;
  /** Field name to message. */
  errors?: Record<string, string>;
  /** What was typed, so a refused form keeps it. */
  values?: Record<string, string>;
} | null;
