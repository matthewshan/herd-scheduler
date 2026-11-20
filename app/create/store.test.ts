import { describe, expect, it } from "vitest";
import { createPollFormStore } from "./store";

// syncToday reads the *local* date of the Date it's given, so build the "now"
// values from local parts — the assertions then hold under any host TZ.
const localNoon = (y: number, m: number, d: number) =>
  new Date(y, m, d, 12, 0, 0);

describe("createPollFormStore syncToday", () => {
  it("moves today back when the server's UTC clock ran a day ahead", () => {
    // Server (UTC) said Dec 1; the user's local date is still Nov 30.
    const store = createPollFormStore({ year: 2026, month: 11, day: 1 });
    store.getState().syncToday(localNoon(2026, 10, 30));
    const s = store.getState();
    expect(s.initial).toEqual({ year: 2026, month: 10, day: 30 });
    // The calendar follows back to November so today is reachable.
    expect({ year: s.year, month: s.month }).toEqual({ year: 2026, month: 10 });
  });

  it("is a no-op when the server and the user agree", () => {
    const store = createPollFormStore({ year: 2026, month: 10, day: 20 });
    const before = store.getState();
    store.getState().syncToday(localNoon(2026, 10, 20));
    expect(store.getState()).toBe(before);
  });

  it("leaves a month the user navigated to alone", () => {
    const store = createPollFormStore({ year: 2026, month: 10, day: 21 });
    store.getState().patch({ year: 2027, month: 1 });
    store.getState().syncToday(localNoon(2026, 10, 20));
    const s = store.getState();
    expect(s.initial).toEqual({ year: 2026, month: 10, day: 20 });
    expect({ year: s.year, month: s.month }).toEqual({ year: 2027, month: 1 });
  });
});
