"use client";

import { useMemo, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "zustand";
import { Calendar, Check, Copy, Plus, Users, X } from "lucide-react";
import {
  AppBar,
  BottomBar,
  Button,
  Field,
  Input,
  MiniCalendar,
  RequiredMark,
  Select,
  Textarea,
  ThemeToggle,
} from "@/components/ui";
import { TIME_OPTS } from "@/lib/calendar";
import { TIMEZONES } from "@/lib/time";
import type { Timezone } from "@prisma/client";
import { createPoll, type CreatePollSlotInput } from "./actions";
import { createPollFormStore, type PollFormStore } from "./store";

export interface CreateFormProps {
  /** Month the calendar opens on (server-computed to avoid hydration drift). */
  initialYear: number;
  initialMonth: number;
  /** Today's day-of-month (server-computed); earlier days aren't selectable. */
  initialDay: number;
}

// The form's transient state lives in a Zustand store (see ./store). We create
// it once per mount (SSR-safe — not a module-level singleton shared across
// requests) seeded with the server-computed calendar anchor, and hand it to the
// single consumer by prop. No context needed while there's one consumer.
export function CreateForm({
  initialYear,
  initialMonth,
  initialDay,
}: CreateFormProps) {
  const storeRef = useRef<PollFormStore | null>(null);
  if (storeRef.current === null) {
    storeRef.current = createPollFormStore({
      year: initialYear,
      month: initialMonth,
      day: initialDay,
    });
  }
  return <CreateFormView store={storeRef.current} />;
}

interface CreateFormViewProps {
  store: PollFormStore;
}

function CreateFormView({ store }: CreateFormViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const form = useStore(store);
  const { patch, toggleDay, addSelected, removeSlot } = form;

  const added = useMemo(
    () => new Set(form.slots.map((s) => s.key)),
    [form.slots],
  );
  const selectedKeys = useMemo(
    () => new Set(Object.keys(form.selected)),
    [form.selected],
  );
  const selCount = selectedKeys.size;

  function submit() {
    patch({ error: null });
    const payload: CreatePollSlotInput[] = form.slots.map((s) => ({
      year: s.year,
      month: s.month,
      day: s.day,
      start: s.start,
      end: s.end,
    }));
    startTransition(async () => {
      const res = await createPoll({
        title: form.title,
        description: form.description,
        location: form.location,
        timezone: form.timezone,
        anonymousVoting: form.anonymous,
        slots: payload,
      });
      if (res.ok) {
        patch({ createdSlug: res.slug });
      } else {
        patch({ error: res.error });
      }
    });
  }

  function copyLink() {
    if (form.createdSlug === null) {
      return;
    }
    const url = `${window.location.origin}/p/${form.createdSlug}`;
    // writeText rejects when the clipboard is blocked (insecure origin, denied
    // permission, headless) — swallow it so it isn't an unhandled rejection.
    void navigator.clipboard?.writeText(url).catch(() => {});
    patch({ copied: true });
    setTimeout(() => patch({ copied: false }), 1600);
  }

  // ---------- success / share state ----------
  if (form.createdSlug !== null) {
    const shareUrl =
      typeof window !== "undefined"
        ? `${window.location.origin}/p/${form.createdSlug}`
        : `/p/${form.createdSlug}`;
    return (
      <>
        <AppBar title="Poll created" backHref="/" right={<ThemeToggle />} />
        <main className="mx-auto w-full max-w-[390px] flex-1 px-4 py-5">
          <div className="rounded-card border border-border bg-surface px-[18px] pb-5 pt-6 text-center shadow-sh-1">
            <div className="border-yes/25 mb-4 flex items-center justify-center gap-2.5 rounded-card border bg-yes-tint px-3 py-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-yes text-white">
                <Check size={18} />
              </span>
              <span className="text-left font-body text-[13px] text-fg2">
                <b className="text-fg1">{form.title.trim()}</b>
                <br />
                {form.slots.length} {form.slots.length === 1 ? "time" : "times"}{" "}
                · ready to share
              </span>
            </div>

            <p className="mb-2 font-body text-[14px] text-fg2">
              Share this with your friends
            </p>

            <div className="flex items-center gap-2 rounded-input border border-border-strong bg-input-bg p-1.5 pl-3">
              <span className="tnum min-w-0 flex-1 truncate text-left font-body text-[13.5px] text-fg1">
                {shareUrl}
              </span>
              <Button size="sm" onClick={copyLink}>
                {form.copied ? <Check size={16} /> : <Copy size={16} />}
                {form.copied ? "Copied" : "Copy link"}
              </Button>
            </div>
          </div>

          <Button
            variant="ghost"
            block
            className="mt-3.5"
            onClick={() => router.push(`/p/${form.createdSlug}/results`)}
          >
            <Users size={18} />
            View responses
          </Button>
        </main>
      </>
    );
  }

  // ---------- build form ----------
  const canSubmit =
    form.title.trim().length > 0 && form.slots.length > 0 && !isPending;

  return (
    <>
      <AppBar title="New poll" backHref="/" right={<ThemeToggle />} />

      <main className="mx-auto w-full max-w-[420px] flex-1 px-4 py-5">
        <Field label="Title" htmlFor="poll-title" required>
          <Input
            id="poll-title"
            value={form.title}
            onChange={(e) => patch({ title: e.target.value })}
            placeholder="e.g. Game night"
            required
            aria-required
          />
        </Field>

        <Field label="Description" htmlFor="poll-desc" optional>
          <Textarea
            id="poll-desc"
            rows={2}
            value={form.description}
            onChange={(e) => patch({ description: e.target.value })}
            placeholder="What's the plan?"
          />
        </Field>

        <Field label="Location" htmlFor="poll-loc" optional>
          <Input
            id="poll-loc"
            value={form.location}
            onChange={(e) => patch({ location: e.target.value })}
            placeholder="Add a place"
          />
        </Field>

        <Field label="Timezone" htmlFor="poll-tz" required>
          <Select
            id="poll-tz"
            value={form.timezone}
            onChange={(e) => patch({ timezone: e.target.value as Timezone })}
            aria-required
          >
            {TIMEZONES.map((tz) => (
              <option key={tz.value} value={tz.value}>
                {tz.label}
              </option>
            ))}
          </Select>
        </Field>

        <h2 className="ds-h2 mb-2.5 mt-6">
          Pick your dates
          <RequiredMark />
        </h2>

        <MiniCalendar
          year={form.year}
          month={form.month}
          onNavigate={(year, month) => patch({ year, month })}
          selected={selectedKeys}
          added={added}
          onToggleDay={toggleDay}
          min={{ year: form.initial.year, month: form.initial.month }}
          minDay={form.initial}
        />

        {/* shared time range applied to the selected days */}
        <div className="mt-3 flex items-center gap-2">
          <span className="font-body text-[13px] font-medium text-fg2">
            Time
          </span>
          <Select
            value={form.rangeStart}
            onChange={(e) => patch({ rangeStart: e.target.value })}
            aria-label="Start time"
            className="flex-1"
          >
            {TIME_OPTS.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </Select>
          <span className="font-body text-[13px] font-medium text-fg2">to</span>
          <Select
            value={form.rangeEnd}
            onChange={(e) => patch({ rangeEnd: e.target.value })}
            aria-label="End time"
            className="flex-1"
          >
            {TIME_OPTS.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </Select>
        </div>

        <Button
          variant="outline"
          block
          className="mt-3"
          onClick={addSelected}
          disabled={selCount === 0}
        >
          <Plus size={18} />
          {selCount === 0
            ? "Add to your poll"
            : `Add ${selCount} ${selCount === 1 ? "day" : "days"} at ${form.rangeStart}`}
        </Button>

        <p className="mt-2 flex items-center justify-center gap-1.5 font-body text-[12.5px] text-fg3">
          <Calendar size={14} />
          {selCount === 0
            ? "Tap days above — pick several at once."
            : `${selCount} selected · uses ${form.rangeStart}–${form.rangeEnd}`}
        </p>

        {form.slots.length > 0 && (
          <>
            <h2 className="ds-h2 mb-2.5 mt-6">
              {form.slots.length} time{" "}
              {form.slots.length === 1 ? "slot" : "slots"} added
            </h2>
            <div className="flex flex-col gap-2">
              {form.slots.map((s) => (
                <div
                  key={s.key}
                  className="flex items-center gap-3 rounded-card border border-border bg-surface px-[14px] py-2.5"
                >
                  <span className="font-body text-[14px] font-medium text-fg1">
                    {s.label}
                  </span>
                  <span className="tnum flex-1 font-body text-[13.5px] text-fg2">
                    {s.start}–{s.end}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeSlot(s.key)}
                    aria-label={`Remove ${s.label}`}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-fg3 transition-colors duration-ds ease-ds hover:bg-surface-2 hover:text-no"
                  >
                    <X size={17} />
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        {/* anonymity toggle — default visible (anonymousVoting = false) */}
        <div className="mt-6 flex items-center gap-3 rounded-card border border-border bg-surface px-[14px] py-3">
          <div className="min-w-0 flex-1">
            <p className="font-body text-[14px] font-medium text-fg1">
              Anonymous responses
            </p>
            <p className="font-body text-[12.5px] text-fg3">
              Hide who voted — show only the totals.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={form.anonymous}
            aria-label="Anonymous responses"
            onClick={() => patch({ anonymous: !form.anonymous })}
            className={`relative h-[26px] w-[44px] flex-shrink-0 rounded-full transition-colors duration-ds ease-ds ${
              form.anonymous ? "bg-brand" : "bg-surface-2"
            }`}
          >
            <span
              className={`absolute top-[3px] h-5 w-5 rounded-full bg-white shadow-sh-1 transition-[left] duration-ds ease-ds ${
                form.anonymous ? "left-[21px]" : "left-[3px]"
              }`}
            />
          </button>
        </div>

        {form.error && (
          <p className="border-no/30 mt-3 rounded-input border bg-no-tint px-3 py-2 font-body text-[13px] text-no-ink">
            {form.error}
          </p>
        )}

        <div className="h-3" />
      </main>

      <BottomBar>
        <Button block disabled={!canSubmit} onClick={submit}>
          {isPending ? "Creating…" : "Create poll"}
        </Button>
      </BottomBar>
    </>
  );
}
