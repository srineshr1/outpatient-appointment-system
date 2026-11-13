/** How to address someone in an email: "Dr Reid" for a doctor, the first name for everyone else. */
const TITLE = /^(dr|doctor|prof|professor)\.?$/i;

export function salutation(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "there";
  const title = TITLE.test(parts[0]!) ? "Dr" : null;
  const rest = title ? parts.slice(1) : parts;
  if (title) {
    // "Dr Callum Reid" -> "Dr Reid"; "Dr Srinesh" -> "Dr Srinesh".
    const surname = rest[rest.length - 1];
    return surname ? `Dr ${surname}` : "Doctor";
  }
  return rest[0] ?? "there";
}

/** "Dr Asha Rao" from "Asha Rao", "Dr. Asha Rao" or "dr asha rao": the title is never doubled. */
export function doctorTitle(name: string, fallback = "Doctor"): string {
  const clean = name.replace(/\s+/g, " ").trim();
  if (!clean) return fallback;
  const rest = clean.replace(/^(dr|doctor)\.?(\s+|$)/i, "").trim();
  return rest ? `Dr ${rest}` : fallback;
}
