/**
 * A pending change is confirmed only by a short, unambiguous yes, or rejected by a short no.
 * Anything with a new time, a date or a "but" goes back to the assistant as a fresh request,
 * so "yes, but make it 3pm" cannot confirm the previous time.
 */
export type ReplyIntent = "confirm" | "reject" | "chat";

const CONFIRM =
  /^(yes|yeah|yep|yup|ok|okay|confirm|confirmed|sure|haan|han|ji|please|go ahead|do it|book it|please do|theek hai|thik hai|kar do|book karo|haan ji|ji haan|हाँ|हां|जी|ठीक है|कर दो|बुक करो|yes please|ok please|okay please)[.!]?$/i;

const REJECT =
  /^(no|nope|nah|don't|dont|do not|stop|cancel|never mind|nevermind|nahi|nahin|mat karo|rehne do|नहीं|मत|रहने दो|no thanks|no thank you)[.!]?$/i;

export function interpretReply(text: string): ReplyIntent {
  const trimmed = text.trim().replace(/\s+/g, " ");
  if (!trimmed || trimmed.length > 40) return "chat";
  if (/\d/.test(trimmed) || /\b(but|except|instead|move|change|reschedule|tomorrow|today|monday|tuesday|wednesday|thursday|friday)\b/i.test(trimmed)) {
    return "chat";
  }
  if (REJECT.test(trimmed)) return "reject";
  if (CONFIRM.test(trimmed)) return "confirm";
  return "chat";
}
