"use client";

import { useState } from "react";
import {
  Clock,
  Copy,
  MapPin,
  Plus,
  Share2,
  Star,
  Trash2,
  Users,
} from "lucide-react";
import {
  AppBar,
  Avatar,
  AvatarStack,
  BottomBar,
  Button,
  Field,
  Input,
  MiniCalendar,
  Pill,
  Segmented,
  Select,
  SlotCard,
  StackedBar,
  Tally,
  Textarea,
  ThemeToggle,
  TzChip,
} from "@/components/ui";
import type { VoteValue } from "@/components/ui";
import { TIME_OPTS, dayId } from "@/lib/calendar";

// Sample identities (colors mirror the design prototype's PEOPLE map).
const PEOPLE: { name: string; color: string }[] = [
  { name: "Alex", color: "#0077b6" },
  { name: "Priya", color: "#7c3aed" },
  { name: "Marcus", color: "#0891b2" },
  { name: "Dana", color: "#db2777" },
  { name: "Sam", color: "#059669" },
  { name: "Jordan", color: "#d97706" },
];

const TZ_LABEL = "Times shown in Eastern Time · ET";

interface SectionProps {
  title: string;
  children: React.ReactNode;
}

function Section({ title, children }: SectionProps) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-body text-[12px] font-semibold uppercase tracking-[0.05em] text-fg3">
        {title}
      </h2>
      {children}
    </section>
  );
}

interface ShowcaseProps {
  /** Namespaces field ids so the two instances don't collide in the DOM. */
  idPrefix: string;
}

// One full pass of every component in its states. Rendered twice (light + dark)
// by the page; each instance owns its own interactive state.
function Showcase({ idPrefix }: ShowcaseProps) {
  const fid = (name: string) => `${idPrefix}-${name}`;
  const [vote, setVote] = useState<VoteValue | null>("yes");
  const [cal, setCal] = useState({ year: 2026, month: 5 }); // June 2026
  const [picked, setPicked] = useState<Set<string>>(
    () => new Set([dayId(2026, 5, 6), dayId(2026, 5, 7)]),
  );
  const added = new Set([dayId(2026, 5, 14)]);

  const toggleDay = (year: number, month: number, day: number) => {
    const id = dayId(year, month, day);
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="flex w-full max-w-[390px] flex-col gap-7 bg-bg p-5 text-fg1">
      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary">Create poll</Button>
          <Button variant="ghost">Cancel</Button>
          <Button variant="outline">Share</Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary" size="sm">
            <Plus size={18} /> Add day
          </Button>
          <Button variant="outline" size="sm">
            <Share2 size={18} /> Copy link
          </Button>
          <Button variant="primary" disabled>
            Disabled
          </Button>
        </div>
        <Button variant="primary" block>
          Submit availability
        </Button>
      </Section>

      <Section title="Inputs">
        <Field label="Poll title" htmlFor={fid("title")}>
          <Input
            id={fid("title")}
            placeholder="e.g. Game night"
            defaultValue="Game Night 🎲"
          />
        </Field>
        <Field label="Location" htmlFor={fid("loc")} optional>
          <Input id={fid("loc")} placeholder="Where?" />
        </Field>
        <Field label="Timezone" htmlFor={fid("tz")}>
          <Select id={fid("tz")} defaultValue="ET">
            <option value="ET">Eastern Time · ET</option>
            <option value="CT">Central Time · CT</option>
            <option value="MT">Mountain Time · MT</option>
            <option value="PT">Pacific Time · PT</option>
            <option value="GMT">GMT</option>
          </Select>
        </Field>
        <Field label="Note" htmlFor={fid("note")} optional>
          <Textarea
            id={fid("note")}
            placeholder="Anything people should know?"
          />
        </Field>
        <Field
          label="Your name"
          htmlFor={fid("name")}
          error="Enter your name so people know who voted."
        >
          <Input
            id={fid("name")}
            error
            defaultValue=""
            placeholder="Your name"
          />
        </Field>
      </Section>

      <Section title="Segmented (tap-to-clear)">
        <Segmented value={vote} onChange={setVote} />
        <p className="font-body text-[12.5px] text-fg2">
          Current: <span className="font-semibold">{vote ?? "not marked"}</span>
        </p>
      </Section>

      <Section title="Slot cards — vote">
        <SlotCard day="Fri, Jun 6" time="7:00–10:00 PM">
          <div className="mt-3">
            <Segmented value="yes" onChange={() => {}} />
          </div>
        </SlotCard>
        <SlotCard day="Sat, Jun 7" time="6:00–9:00 PM">
          <div className="mt-3">
            <Segmented value={null} onChange={() => {}} />
          </div>
        </SlotCard>
      </Section>

      <Section title="Slot cards — results">
        <SlotCard
          day="Sat, Jun 7"
          time="6:00–9:00 PM"
          best
          badge={
            <Pill variant="best" icon={<Star size={14} />}>
              Best fit
            </Pill>
          }
        >
          <div className="mt-3">
            <StackedBar y={5} m={1} n={0} />
          </div>
          <div className="mt-[9px] flex items-center justify-between">
            <Tally y={5} m={1} n={0} />
            <AvatarStack
              names={["Alex", "Priya", "Marcus", "Dana", "Sam"]}
              size={28}
            />
          </div>
        </SlotCard>
        <SlotCard
          day="Fri, Jun 6"
          time="7:00–10:00 PM"
          badge={<Pill variant="all">Works for everyone</Pill>}
        >
          <div className="mt-3">
            <StackedBar y={3} m={1} n={2} />
          </div>
          <div className="mt-[9px]">
            <Tally y={3} m={1} n={2} />
          </div>
        </SlotCard>
        <SlotCard
          day="Sun, Jun 8"
          time="5:00–8:00 PM"
          finalized
          badge={<Pill variant="finalized">Finalized</Pill>}
        >
          <div className="mt-3">
            <StackedBar y={2} m={1} n={3} />
          </div>
          <div className="mt-[9px]">
            <Tally y={2} m={1} n={3} />
          </div>
        </SlotCard>
      </Section>

      <Section title="Tally + bar">
        <StackedBar y={4} m={2} n={1} />
        <Tally y={4} m={2} n={1} />
      </Section>

      <Section title="Avatars">
        <div className="flex items-center gap-3">
          {PEOPLE.map((p) => (
            <Avatar key={p.name} name={p.name} color={p.color} size={40} />
          ))}
        </div>
        <div className="flex items-center gap-4">
          <AvatarStack names={PEOPLE.map((p) => p.name)} />
          <AvatarStack names={["Alex", "Priya"]} />
        </div>
      </Section>

      <Section title="Timezone chip">
        <div>
          <TzChip label={TZ_LABEL} />
        </div>
      </Section>

      <Section title="Pills">
        <div className="flex flex-wrap items-center gap-2">
          <Pill variant="best" icon={<Star size={14} />}>
            Best fit
          </Pill>
          <Pill variant="all">Works for everyone</Pill>
          <Pill variant="finalized">Finalized</Pill>
        </div>
      </Section>

      <Section title="Mini calendar (multi-select)">
        <MiniCalendar
          year={cal.year}
          month={cal.month}
          onNavigate={(year, month) => setCal({ year, month })}
          selected={picked}
          added={added}
          onToggleDay={toggleDay}
          min={{ year: 2026, month: 4 }}
          max={{ year: 2026, month: 7 }}
        />
        <div className="flex items-center gap-2">
          <Select defaultValue={TIME_OPTS[0]} aria-label="Start time">
            {TIME_OPTS.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </Select>
          <span className="font-body text-[12.5px] text-fg2">to</span>
          <Select defaultValue={TIME_OPTS[6]} aria-label="End time">
            {TIME_OPTS.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </Select>
        </div>
      </Section>

      <Section title="App bar">
        <div className="overflow-hidden rounded-card border border-border">
          <AppBar
            title="Game Night 🎲"
            onBack={() => {}}
            right={<ThemeToggle />}
            hostLine={
              <>
                <span className="inline-flex items-center gap-1">
                  <Users size={14} /> Hosted by Alex
                </span>
                <span className="text-border-strong">·</span>
                <span className="inline-flex items-center gap-1">
                  <MapPin size={14} /> Alex&apos;s place
                </span>
                <TzChip label={TZ_LABEL} />
              </>
            }
          />
          <div className="bg-bg p-4 font-body text-[13px] text-fg2">
            Scrollable screen body…
          </div>
        </div>
      </Section>

      <Section title="Bottom bar">
        <div className="overflow-hidden rounded-card border border-border">
          <div className="bg-bg p-4 font-body text-[13px] text-fg2">
            Scrollable screen body…
          </div>
          <BottomBar hint="2 of 4 marked" progress={0.5}>
            <Button variant="primary" block>
              Submit availability
            </Button>
          </BottomBar>
        </div>
      </Section>

      <Section title="Slot editor row (create)">
        <div className="flex items-center gap-2">
          <Input
            className="flex-[1.3]"
            defaultValue="Fri, Jun 6"
            aria-label="Day"
          />
          <Input className="flex-1" defaultValue="7:00 PM" aria-label="Time" />
          <button
            type="button"
            aria-label="Remove slot"
            className="flex h-[46px] w-10 flex-shrink-0 items-center justify-center rounded-[10px] border border-border bg-input-bg text-fg3 transition-colors duration-ds ease-ds hover:border-no-tint hover:bg-no-tint hover:text-no"
          >
            <Trash2 size={18} />
          </button>
        </div>
        <div className="flex items-center gap-2 font-body text-[12px] text-fg3">
          <Clock size={14} /> 30-minute increments
          <Copy size={14} className="ml-2" /> duplicate
        </div>
      </Section>
    </div>
  );
}

export default function GalleryPage() {
  return (
    <div className="min-h-screen bg-frame-canvas">
      <div className="mx-auto flex max-w-[860px] flex-col gap-4 px-4 py-8">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="ds-h1">Component gallery</h1>
            <p className="font-body text-[13px] text-fg2">
              Phase 3 kit — every component, light + dark. Dev-only.
            </p>
          </div>
          <ThemeToggle />
        </header>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div
            data-theme="light"
            className="flex justify-center rounded-card border border-border bg-bg"
          >
            <Showcase idPrefix="light" />
          </div>
          <div
            data-theme="dark"
            className="flex justify-center rounded-card border border-border bg-bg"
          >
            <Showcase idPrefix="dark" />
          </div>
        </div>
      </div>
    </div>
  );
}
