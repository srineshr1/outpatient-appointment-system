import { describe, expect, it } from "vitest";
import {
  hourOptions,
  indexFromOffset,
  minuteOptions,
  nearestValue,
  nudge,
  offsetForIndex,
  pad2,
  shiftHours,
  wheelValues,
  withHour,
  withMinute,
} from "./time-wheel";

const h = (hour: number, minute = 0) => hour * 60 + minute;

describe("wheelValues", () => {
  it("lists every step from min to max inclusive", () => {
    expect(wheelValues(h(8), h(9), 20)).toEqual([h(8), h(8, 20), h(8, 40), h(9)]);
  });
  it("keeps an off-hour grid anchored at min", () => {
    expect(wheelValues(h(8, 5), h(8, 35), 15)).toEqual([h(8, 5), h(8, 20), h(8, 35)]);
  });
  it("always returns min when the range is empty or collapsed", () => {
    expect(wheelValues(h(10), h(10), 5)).toEqual([h(10)]);
    expect(wheelValues(h(10), h(9), 5)).toEqual([h(10)]);
  });
});

describe("hours and minutes", () => {
  const values = wheelValues(h(8, 40), h(10, 20), 20);
  it("offers only hours that hold a selectable time", () => {
    expect(hourOptions(values)).toEqual([8, 9, 10]);
  });
  it("offers only minutes on the grid inside each hour", () => {
    expect(minuteOptions(values, 8)).toEqual([40]);
    expect(minuteOptions(values, 9)).toEqual([0, 20, 40]);
    expect(minuteOptions(values, 10)).toEqual([0, 20]);
  });
  it("handles steps that do not divide an hour", () => {
    const odd = wheelValues(h(8), h(10), 25);
    expect(minuteOptions(odd, 8)).toEqual([0, 25, 50]);
    expect(minuteOptions(odd, 9)).toEqual([15, 40]);
  });
});

describe("snapping and clamping", () => {
  const values = wheelValues(h(8), h(13, 40), 20);
  it("snaps to the nearest grid value", () => {
    expect(nearestValue(values, h(8, 49))).toBe(h(8, 40));
    expect(nearestValue(values, h(8, 51))).toBe(h(9));
    expect(nearestValue(values, h(7))).toBe(h(8));
    expect(nearestValue(values, h(17))).toBe(h(13, 40));
  });
  it("keeps the minute when spinning the hour drum, else takes the closest in that hour", () => {
    expect(withHour(values, h(8, 40), 11)).toBe(h(11, 40));
    const tail = wheelValues(h(8, 40), h(10, 20), 20);
    expect(withHour(tail, h(9, 40), 10)).toBe(h(10, 20));
    expect(withHour(tail, h(9, 0), 8)).toBe(h(8, 40));
  });
  it("sets the minute inside the current hour, snapped", () => {
    expect(withMinute(values, h(9, 0), 40)).toBe(h(9, 40));
    expect(withMinute(values, h(9, 0), 33)).toBe(h(9, 40));
  });
  it("nudges by grid steps across hours and stops at the ends", () => {
    expect(nudge(values, h(8, 40), 1)).toBe(h(9));
    expect(nudge(values, h(9), -2)).toBe(h(8, 20));
    expect(nudge(values, h(8), -1)).toBe(h(8));
    expect(nudge(values, h(13, 40), 3)).toBe(h(13, 40));
  });
  it("moves about an hour per page and clamps to min and max", () => {
    expect(shiftHours(values, h(9, 20), 1)).toBe(h(10, 20));
    expect(shiftHours(values, h(13, 20), 1)).toBe(h(13, 40));
    expect(shiftHours(values, h(8, 20), -1)).toBe(h(8));
  });
});

describe("drum geometry", () => {
  it("maps scroll offset to the row under the centre line", () => {
    expect(indexFromOffset(0, 30, 5)).toBe(0);
    expect(indexFromOffset(44, 30, 5)).toBe(1);
    expect(indexFromOffset(46, 30, 5)).toBe(2);
    expect(indexFromOffset(-20, 30, 5)).toBe(0);
    expect(indexFromOffset(999, 30, 5)).toBe(4);
    expect(indexFromOffset(10, 30, 0)).toBe(0);
  });
  it("round-trips index and offset", () => {
    for (let i = 0; i < 6; i += 1) expect(indexFromOffset(offsetForIndex(i, 30), 30, 6)).toBe(i);
  });
  it("pads to two digits", () => {
    expect(pad2(8)).toBe("08");
    expect(pad2(40)).toBe("40");
  });
});
