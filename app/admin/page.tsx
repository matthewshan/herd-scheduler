import { Ban, Plus, RotateCcw, Trash2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/auth";
import { isAllowlistEnabled, isOwnerEmail } from "@/lib/access";
import {
  AppBar,
  Avatar,
  Button,
  Input,
  Select,
  ThemeToggle,
} from "@/components/ui";
import { addCreator, blockEmail, removeCreator, unblockEmail } from "./actions";

export const metadata = {
  title: "Manage access — Herd Scheduler",
};

// The actions worth filtering the audit log by (matches logAction call sites).
const AUDIT_ACTIONS = [
  "signin",
  "poll.create",
  "poll.update",
  "poll.close",
  "poll.finalize",
  "poll.delete",
  "vote.cast",
  "vote.update",
  "creator.add",
  "creator.remove",
  "email.block",
  "email.unblock",
];

// Render audit timestamps in a fixed display zone so they read the same no
// matter what timezone the container runs in. Configurable via APP_TIMEZONE
// (the app's display default); falls back to ET if unset or invalid.
function makeAuditFmt(): Intl.DateTimeFormat {
  const tz = process.env.APP_TIMEZONE || "America/New_York";
  const opts: Intl.DateTimeFormatOptions = {
    dateStyle: "medium",
    timeStyle: "short",
  };
  try {
    return new Intl.DateTimeFormat("en-US", { ...opts, timeZone: tz });
  } catch {
    return new Intl.DateTimeFormat("en-US", {
      ...opts,
      timeZone: "America/New_York",
    });
  }
}

const fmt = makeAuditFmt();

interface AdminPageProps {
  searchParams: Promise<{ action?: string }>;
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  await requireOwner();
  const { action: actionFilter } = await searchParams;
  const allowlistOn = isAllowlistEnabled();

  const [creators, blocked, logs] = await Promise.all([
    prisma.allowedCreator.findMany({ orderBy: { addedAt: "asc" } }),
    prisma.blockedEmail.findMany({ orderBy: { blockedAt: "desc" } }),
    prisma.auditLog.findMany({
      where: actionFilter ? { action: actionFilter } : undefined,
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  return (
    <>
      <AppBar
        title="Manage access"
        backHref="/"
        right={<ThemeToggle />}
        hostLine={
          allowlistOn
            ? "Allowlist on — only approved creators can make polls"
            : "Allowlist off — any verified sign-in can make polls"
        }
      />

      <main className="mx-auto flex max-w-[390px] flex-col gap-8 px-4 py-5">
        {/* Approved creators — only relevant while the allowlist gates creation */}
        {allowlistOn ? (
          <section>
            <h2 className="ds-h2 mb-1">Approved creators</h2>
            <p className="mb-3 font-body text-[13px] text-fg2">
              Only these people can create new polls.
            </p>

            <form action={addCreator} className="mb-3 flex gap-2">
              <Input
                name="email"
                type="email"
                placeholder="name@email.com"
                aria-label="Email to approve"
                required
                className="flex-1"
              />
              <Button type="submit" size="md">
                <Plus size={16} />
                Add
              </Button>
            </form>

            <div className="rounded-card border border-border bg-surface">
              {creators.length === 0 && (
                <p className="px-[14px] py-4 font-body text-[13px] text-fg3">
                  No approved creators yet.
                </p>
              )}
              {creators.map((c) => {
                const owner = isOwnerEmail(c.email);
                return (
                  <div
                    key={c.id}
                    className="flex items-center gap-3 border-b border-border px-[14px] py-2.5 last:border-b-0"
                  >
                    <Avatar name={c.email} size={32} />
                    <span className="min-w-0 flex-1 truncate font-body text-[14px] text-fg1">
                      {c.email}
                    </span>
                    {owner ? (
                      <span className="rounded-pill bg-brand-tint px-2.5 py-1 font-body text-[12px] font-semibold text-brand">
                        Owner
                      </span>
                    ) : (
                      <form action={removeCreator}>
                        <input type="hidden" name="email" value={c.email} />
                        <button
                          type="submit"
                          aria-label={`Remove ${c.email}`}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-fg3 transition-colors duration-ds ease-ds hover:bg-surface-2 hover:text-no"
                        >
                          <Trash2 size={16} />
                        </button>
                      </form>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ) : (
          <section className="rounded-card border border-border bg-surface-2 px-[14px] py-3.5">
            <h2 className="ds-h2 mb-1">Approved creators</h2>
            <p className="font-body text-[13px] text-fg2">
              The allowlist is off (
              <code className="font-mono">ALLOWLIST_ENABLED=false</code>), so
              any verified Google sign-in can create polls. Set it to{" "}
              <code className="font-mono">true</code> to manage an allowlist
              here. The blocklist below still applies.
            </p>
          </section>
        )}

        {/* Blocklist — reactive ban, applies in both modes */}
        <section>
          <h2 className="ds-h2 mb-1">Blocked emails</h2>
          <p className="mb-3 font-body text-[13px] text-fg2">
            Blocked people can&apos;t sign in or create polls, in either mode.
          </p>

          <form action={blockEmail} className="mb-3 flex flex-col gap-2">
            <div className="flex gap-2">
              <Input
                name="email"
                type="email"
                placeholder="name@email.com"
                aria-label="Email to block"
                required
                className="flex-1"
              />
              <Button type="submit" variant="outline" size="md">
                <Ban size={16} />
                Block
              </Button>
            </div>
            <Input
              name="reason"
              type="text"
              placeholder="Reason (optional)"
              aria-label="Reason for blocking"
            />
          </form>

          <div className="rounded-card border border-border bg-surface">
            {blocked.length === 0 && (
              <p className="px-[14px] py-4 font-body text-[13px] text-fg3">
                No blocked emails.
              </p>
            )}
            {blocked.map((b) => (
              <div
                key={b.id}
                className="flex items-center gap-3 border-b border-border px-[14px] py-2.5 last:border-b-0"
              >
                <Avatar name={b.email} size={32} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-body text-[14px] text-fg1">
                    {b.email}
                  </span>
                  {b.reason && (
                    <span className="block truncate font-body text-[12px] text-fg3">
                      {b.reason}
                    </span>
                  )}
                </span>
                <form action={unblockEmail}>
                  <input type="hidden" name="email" value={b.email} />
                  <button
                    type="submit"
                    aria-label={`Unblock ${b.email}`}
                    className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 font-body text-[13px] font-medium text-fg2 transition-colors duration-ds ease-ds hover:bg-surface-2 hover:text-fg1"
                  >
                    <RotateCcw size={15} />
                    Unblock
                  </button>
                </form>
              </div>
            ))}
          </div>
        </section>

        {/* Audit log — owner-only review (never sourced by the Results API) */}
        <section>
          <h2 className="ds-h2 mb-1">Activity log</h2>
          <p className="mb-3 font-body text-[13px] text-fg2">
            Recent actions, newest first. For abuse review only.
          </p>

          <form method="get" className="mb-3 flex gap-2">
            <Select
              name="action"
              defaultValue={actionFilter ?? ""}
              aria-label="Filter by action"
              className="flex-1"
            >
              <option value="">All actions</option>
              {AUDIT_ACTIONS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </Select>
            <Button type="submit" variant="ghost" size="md">
              Filter
            </Button>
          </form>

          <div className="rounded-card border border-border bg-surface">
            {logs.length === 0 && (
              <p className="px-[14px] py-4 font-body text-[13px] text-fg3">
                No matching activity.
              </p>
            )}
            {logs.map((log) => (
              <div
                key={log.id}
                className="border-b border-border px-[14px] py-2.5 last:border-b-0"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[12.5px] font-semibold text-fg1">
                    {log.action}
                  </span>
                  <time className="tnum font-body text-[11.5px] text-fg3">
                    {fmt.format(log.createdAt)}
                  </time>
                </div>
                <div className="mt-0.5 font-body text-[12.5px] text-fg2">
                  {log.actorEmail ?? log.guestName ?? "—"}
                  {log.targetId && (
                    <span className="text-fg3">
                      {" → "}
                      {log.targetType ? `${log.targetType}:` : ""}
                      {log.targetId}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
