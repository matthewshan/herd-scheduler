"use client";

import { useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
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
import { CreateFormStoreProvider, useCreateForm } from "./store-provider";

export interface CreateFormProps {
  /** Month the calendar opens on (server-computed to avoid hydration drift). */
  initialYear: number;
  initialMonth: number;
  /** Today's day-of-month (server-computed); earlier days aren't selectable. */
  initialDay: number;
}

// The form's transient state lives in a Zustand store (see ./store); this is
// just the provider boundary that seeds it with the server-computed anchor.
export function CreateForm({
  initialYear,
  initialMonth,
  initialDay,
}: CreateFormProps) {
  return (
    <CreateFormStoreProvider
      init={{ year: initialYear, month: initialMonth, day: initialDay }}
    >
      <CreateFormView />
    </CreateFormStoreProvider>
  );
}

function CreateFormView() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Poll meta.
  const title = useCreateForm((s) => s.title);
  const description = useCreateForm((s) => s.description);
  const location = useCreateForm((s) => s.location);
  const timezone = useCreateForm((s) => s.timezone);
  const anonymous = useCreateForm((s) => s.anonymous);
  const setTitle = useCreateForm((s) => s.setTitle);
  const setDescription = useCreateForm((s) => s.setDescription);
  const setLocation = useCreateForm((s) => s.setLocation);
  const setTimezone = useCreateForm((s) => s.setTimezone);
  const toggleAnonymous = useCreateForm((s) => s.toggleAnonymous);

  // Calendar / working range.
  const initial = useCreateForm((s) => s.initial);
  const year = useCreateForm((s) => s.year);
  const month = useCreateForm((s) => s.month);
  const selected = useCreateForm((s) => s.selected);
  const rangeStart = useCreateForm((s) => s.rangeStart);
  const rangeEnd = useCreateForm((s) => s.rangeEnd);
  const navigateMonth = useCreateForm((s) => s.navigateMonth);
  const toggleDay = useCreateForm((s) => s.toggleDay);
  const setRangeStart = useCreateForm((s) => s.setRangeStart);
  const setRangeEnd = useCreateForm((s) => s.setRangeEnd);
  const addSelected = useCreateForm((s) => s.addSelected);

  // Working set + status.
  const slots = useCreateForm((s) => s.slots);
  const error = useCreateForm((s) => s.error);
  const removeSlot = useCreateForm((s) => s.removeSlot);
  const setError = useCreateForm((s) => s.setError);

  // Share/success.
  const createdSlug = useCreateForm((s) => s.createdSlug);
  const copied = useCreateForm((s) => s.copied);
  const setCreatedSlug = useCreateForm((s) => s.setCreatedSlug);
  const setCopied = useCreateForm((s) => s.setCopied);

  const added = useMemo(() => new Set(slots.map((s) => s.key)), [slots]);
  const selectedKeys = useMemo(
    () => new Set(Object.keys(selected)),
    [selected],
  );
  const selCount = selectedKeys.size;

  function submit() {
    setError(null);
    const payload: CreatePollSlotInput[] = slots.map((s) => ({
      year: s.year,
      month: s.month,
      day: s.day,
      start: s.start,
      end: s.end,
    }));
    startTransition(async () => {
      const res = await createPoll({
        title,
        description,
        location,
        timezone,
        anonymousVoting: anonymous,
        slots: payload,
      });
      if (res.ok) {
        setCreatedSlug(res.slug);
      } else {
        setError(res.error);
      }
    });
  }

  function copyLink() {
    if (createdSlug === null) {
      return;
    }
    const url = `${window.location.origin}/p/${createdSlug}`;
    navigator.clipboard?.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  // ---------- success / share state ----------
  if (createdSlug !== null) {
    const shareUrl =
      typeof window !== "undefined"
        ? `${window.location.origin}/p/${createdSlug}`
        : `/p/${createdSlug}`;
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
                <b className="text-fg1">{title.trim()}</b>
                <br />
                {slots.length} {slots.length === 1 ? "time" : "times"} · ready
                to share
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
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {copied ? "Copied" : "Copy link"}
              </Button>
            </div>
          </div>

          <Button
            variant="ghost"
            block
            className="mt-3.5"
            onClick={() => router.push(`/p/${createdSlug}`)}
          >
            <Users size={18} />
            View responses
          </Button>
        </main>
      </>
    );
  }

  // ---------- build form ----------
  const canSubmit = title.trim().length > 0 && slots.length > 0 && !isPending;

  return (
    <>
      <AppBar title="New poll" backHref="/" right={<ThemeToggle />} />

      <main className="mx-auto w-full max-w-[420px] flex-1 px-4 py-5">
        <Field label="Title" htmlFor="poll-title" required>
          <Input
            id="poll-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Game night"
            required
            aria-required
          />
        </Field>

        <Field label="Description" htmlFor="poll-desc" optional>
          <Textarea
            id="poll-desc"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What's the plan?"
          />
        </Field>

        <Field label="Location" htmlFor="poll-loc" optional>
          <Input
            id="poll-loc"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Add a place"
          />
        </Field>

        <Field label="Timezone" htmlFor="poll-tz" required>
          <Select
            id="poll-tz"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value as Timezone)}
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
          year={year}
          month={month}
          onNavigate={navigateMonth}
          selected={selectedKeys}
          added={added}
          onToggleDay={toggleDay}
          min={{ year: initial.year, month: initial.month }}
          minDay={initial}
        />

        {/* shared time range applied to the selected days */}
        <div className="mt-3 flex items-center gap-2">
          <span className="font-body text-[13px] font-medium text-fg2">
            Time
          </span>
          <Select
            value={rangeStart}
            onChange={(e) => setRangeStart(e.target.value)}
            aria-label="Start time"
            className="flex-1"
          >
            {TIME_OPTS.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </Select>
          <span className="font-body text-[13px] font-medium text-fg2">to</span>
          <Select
            value={rangeEnd}
            onChange={(e) => setRangeEnd(e.target.value)}
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
            : `Add ${selCount} ${selCount === 1 ? "day" : "days"} at ${rangeStart}`}
        </Button>

        <p className="mt-2 flex items-center justify-center gap-1.5 font-body text-[12.5px] text-fg3">
          <Calendar size={14} />
          {selCount === 0
            ? "Tap days above — pick several at once."
            : `${selCount} selected · uses ${rangeStart}–${rangeEnd}`}
        </p>

        {slots.length > 0 && (
          <>
            <h2 className="ds-h2 mb-2.5 mt-6">
              {slots.length} time {slots.length === 1 ? "slot" : "slots"} added
            </h2>
            <div className="flex flex-col gap-2">
              {slots.map((s) => (
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
            aria-checked={anonymous}
            aria-label="Anonymous responses"
            onClick={toggleAnonymous}
            className={`relative h-[26px] w-[44px] flex-shrink-0 rounded-full transition-colors duration-ds ease-ds ${
              anonymous ? "bg-brand" : "bg-surface-2"
            }`}
          >
            <span
              className={`absolute top-[3px] h-5 w-5 rounded-full bg-white shadow-sh-1 transition-[left] duration-ds ease-ds ${
                anonymous ? "left-[21px]" : "left-[3px]"
              }`}
            />
          </button>
        </div>

        {error && (
          <p className="border-no/30 mt-3 rounded-input border bg-no-tint px-3 py-2 font-body text-[13px] text-no-ink">
            {error}
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
