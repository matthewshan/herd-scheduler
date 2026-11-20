import { beforeEach, describe, expect, it, vi } from "vitest";

// blockEmail must end the blocked person's live sessions in the same
// transaction as the block (the blocklist is otherwise only read at sign-in).
vi.mock("@/lib/prisma", () => {
  const prisma = {
    blockedEmail: { upsert: vi.fn(() => "UPSERT_OP") },
    session: { deleteMany: vi.fn(() => "DELETE_SESSIONS_OP") },
    auditLog: { create: vi.fn(async () => ({})) },
    $transaction: vi.fn(async () => [{}, { count: 2 }]),
  };
  return { prisma };
});
vi.mock("@/lib/auth", () => ({
  requireOwner: vi.fn(async () => ({
    id: "owner-id",
    email: "owner@example.com",
    isOwner: true,
  })),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Map()) }));

import { prisma } from "@/lib/prisma";
import { blockEmail } from "@/app/admin/actions";

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    fd.set(k, v);
  }
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.OWNER_EMAIL = "owner@example.com";
});

describe("blockEmail", () => {
  it("blocks and deletes the user's sessions in one transaction", async () => {
    await blockEmail(form({ email: " Bad@Example.com ", reason: "spam" }));

    expect(prisma.blockedEmail.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: "bad@example.com" } }),
    );
    expect(prisma.session.deleteMany).toHaveBeenCalledWith({
      where: {
        user: { email: { equals: "bad@example.com", mode: "insensitive" } },
      },
    });
    expect(prisma.$transaction).toHaveBeenCalledWith([
      "UPSERT_OP",
      "DELETE_SESSIONS_OP",
    ]);
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "email.block",
        targetId: "bad@example.com",
        metadata: { reason: "spam", sessionsRevoked: 2 },
      }),
    });
  });

  it("never blocks (or signs out) the owner", async () => {
    await blockEmail(form({ email: "OWNER@example.com" }));
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.session.deleteMany).not.toHaveBeenCalled();
  });

  it("ignores an invalid email", async () => {
    await blockEmail(form({ email: "not-an-email" }));
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
