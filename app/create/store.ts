import { createStore } from "zustand/vanilla";
import type { Timezone } from "@prisma/client";
import { TIME_OPTS, dayId, dayLabel } from "@/lib/calendar";
import { DEFAULT_TIMEZONE } from "@/lib/time";

// A slot in the working set: the calendar day plus the shared time range. `key`
// is the dayId so we can ring already-added days on the calendar.
export interface DraftSlot {
  key: string;
  year: number;
  month: number;
  day: number;
  label: string;
  start: string;
  end: string;
}

const startIndex = (label: string) => TIME_OPTS.indexOf(label);

// Order the working set chronologically so the added list and the stored
// sortOrder match what a voter will later see.
function byChrono(a: DraftSlot, b: DraftSlot): number {
  if (a.key !== b.key) {
    return a.key < b.key ? -1 : 1;
  }
  return startIndex(a.start) - startIndex(b.start);
}

// Server-computed calendar anchor: the month the calendar opens on and today's
// day-of-month (earlier days aren't selectable). Passed in to avoid hydration
// drift between server and client.
export interface CreateFormInit {
  year: number;
  month: number;
  day: number;
}

export interface CreateFormState {
  // ----- poll meta -----
  title: string;
  description: string;
  location: string;
  timezone: Timezone;
  anonymous: boolean;

  // ----- calendar / working range -----
  /** The earliest selectable day (fixed at mount); also the calendar's `min`. */
  initial: CreateFormInit;
  /** Currently displayed month (calendar nav). */
  year: number;
  month: number;
  /** Days toggled on but not yet added, keyed by dayId. */
  selected: Record<string, DraftSlot>;
  rangeStart: string;
  rangeEnd: string;

  // ----- committed working set -----
  slots: DraftSlot[];
  error: string | null;

  // ----- share/success -----
  createdSlug: string | null;
  copied: boolean;

  // ----- actions -----
  setTitle: (v: string) => void;
  setDescription: (v: string) => void;
  setLocation: (v: string) => void;
  setTimezone: (v: Timezone) => void;
  toggleAnonymous: () => void;
  navigateMonth: (year: number, month: number) => void;
  toggleDay: (year: number, month: number, day: number) => void;
  setRangeStart: (v: string) => void;
  setRangeEnd: (v: string) => void;
  addSelected: () => void;
  removeSlot: (key: string) => void;
  setError: (v: string | null) => void;
  setCreatedSlug: (v: string | null) => void;
  setCopied: (v: boolean) => void;
}

export type CreateFormStore = ReturnType<typeof createCreateFormStore>;

export function createCreateFormStore(init: CreateFormInit) {
  return createStore<CreateFormState>((set, get) => ({
    title: "",
    description: "",
    location: "",
    timezone: DEFAULT_TIMEZONE,
    anonymous: false,

    initial: init,
    year: init.year,
    month: init.month,
    selected: {},
    rangeStart: "7:00 PM",
    rangeEnd: "10:00 PM",

    slots: [],
    error: null,

    createdSlug: null,
    copied: false,

    setTitle: (title) => set({ title }),
    setDescription: (description) => set({ description }),
    setLocation: (location) => set({ location }),
    setTimezone: (timezone) => set({ timezone }),
    toggleAnonymous: () => set((s) => ({ anonymous: !s.anonymous })),

    navigateMonth: (year, month) => set({ year, month }),

    toggleDay: (year, month, day) => {
      const key = dayId(year, month, day);
      const { selected, rangeStart, rangeEnd } = get();
      const next = { ...selected };
      if (next[key]) {
        delete next[key];
      } else {
        next[key] = {
          key,
          year,
          month,
          day,
          label: dayLabel(year, month, day),
          start: rangeStart,
          end: rangeEnd,
        };
      }
      set({ selected: next });
    },

    setRangeStart: (rangeStart) => set({ rangeStart }),
    setRangeEnd: (rangeEnd) => set({ rangeEnd }),

    addSelected: () => {
      const { selected, rangeStart, rangeEnd, slots } = get();
      if (Object.keys(selected).length === 0) {
        return;
      }
      if (startIndex(rangeEnd) <= startIndex(rangeStart)) {
        set({ error: "End time must be after the start time." });
        return;
      }
      const additions = Object.values(selected).map((s) => ({
        ...s,
        start: rangeStart,
        end: rangeEnd,
      }));
      // Replace any existing slot for the same day with the new range.
      const keys = new Set(additions.map((a) => a.key));
      const kept = slots.filter((s) => !keys.has(s.key));
      set({
        error: null,
        slots: [...kept, ...additions].sort(byChrono),
        selected: {}, // last range persists in rangeStart/rangeEnd (sticky)
      });
    },

    removeSlot: (key) =>
      set((s) => ({ slots: s.slots.filter((slot) => slot.key !== key) })),

    setError: (error) => set({ error }),
    setCreatedSlug: (createdSlug) => set({ createdSlug }),
    setCopied: (copied) => set({ copied }),
  }));
}
