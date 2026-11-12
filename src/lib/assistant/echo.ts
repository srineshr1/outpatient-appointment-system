/** True when a transcript is the assistant hearing itself, not a new request. */
export function isEcho(heard: string, spoken: string): boolean {
  const a = normalise(heard);
  const b = normalise(spoken);
  if (!a || !b) return false;
  if (a === b) return true;
  const shorter = a.length < b.length ? a : b;
  const longer = a.length < b.length ? b : a;
  if (shorter.length >= 12 && longer.includes(shorter)) return true;
  const left = new Set(a.split(" ").filter((word) => word.length > 2));
  const right = new Set(b.split(" ").filter((word) => word.length > 2));
  if (left.size === 0 || right.size === 0) return false;
  let shared = 0;
  for (const word of left) if (right.has(word)) shared += 1;
  const union = left.size + right.size - shared;
  return union > 0 && shared / union >= 0.6;
}

function normalise(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}
