// Pure helpers behind the Android-style start/end time wheels in the session editor.
// Times are minutes after midnight. Every selectable value sits on the editor's `step` grid
// between `min` and `max`, exactly like the range sliders the wheels replaced.

/** All selectable times: min, min + step, … up to max (always at least `min`). */
export function wheelValues(min: number, max: number, step: number): number[] {
  const size = Math.max(1, Math.round(step));
  const values: number[] = [];
  for (let value = min; value <= max; value += size) values.push(value);
  return values.length ? values : [min];
}

/** The allowed value closest to `value` (ties go to the earlier one). */
export function nearestValue(values: readonly number[], value: number): number {
  if (!values.length) return value;
  let best = values[0] ?? value;
  for (const candidate of values) {
    if (Math.abs(candidate - value) < Math.abs(best - value)) best = candidate;
  }
  return best;
}

/** Hours (0–23) that hold at least one selectable time, in order. */
export function hourOptions(values: readonly number[]): number[] {
  return [...new Set(values.map((value) => Math.floor(value / 60)))];
}

/** Selectable minute-of-hour values inside one hour, in order. */
export function minuteOptions(values: readonly number[], hour: number): number[] {
  return values.filter((value) => Math.floor(value / 60) === hour).map((value) => value % 60);
}

/**
 * Moves `current` to another hour. Keeps the minute when that hour allows it, otherwise picks the
 * closest selectable time inside the target hour (like Android when the hour drum spins).
 */
export function withHour(values: readonly number[], current: number, hour: number): number {
  const inHour = values.filter((value) => Math.floor(value / 60) === hour);
  if (!inHour.length) return nearestValue(values, hour * 60 + (current % 60));
  return nearestValue(inHour, hour * 60 + (current % 60));
}

/** Replaces the minute of `current`, staying in its hour; snaps to the grid. */
export function withMinute(values: readonly number[], current: number, minute: number): number {
  return withHour(values, Math.floor(current / 60) * 60 + minute, Math.floor(current / 60));
}

/** Steps `current` by `steps` grid positions, clamped to the first/last value. */
export function nudge(values: readonly number[], current: number, steps: number): number {
  const at = values.indexOf(nearestValue(values, current));
  return values[Math.min(values.length - 1, Math.max(0, at + steps))] ?? current;
}

/** Moves roughly an hour per step (PageUp/PageDown), snapped and clamped to the grid. */
export function shiftHours(values: readonly number[], current: number, hours: number): number {
  const target = current + hours * 60;
  const first = values[0] ?? current;
  const last = values[values.length - 1] ?? current;
  return nearestValue(values, Math.min(last, Math.max(first, target)));
}

/** Row index under the centre line for a drum scrolled `offset` px with rows `rowHeight` px tall. */
export function indexFromOffset(offset: number, rowHeight: number, count: number): number {
  if (count <= 0 || rowHeight <= 0) return 0;
  return Math.min(count - 1, Math.max(0, Math.round(offset / rowHeight)));
}

/** Scroll offset that puts row `index` under the centre line. */
export function offsetForIndex(index: number, rowHeight: number): number {
  return Math.max(0, index) * rowHeight;
}

export function pad2(value: number): string {
  return String(value).padStart(2, "0");
}
