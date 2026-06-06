import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the DB and request-headers deps so this is a pure unit test of the
// access logic (Phase 9 adds the real-Postgres integration layer on top).
vi.mock("@/lib/prisma", () => ({
  prisma: {
    blockedEmail: { findUnique: vi.fn() },
    allowedCreator: { findUnique: vi.fn() },
  },
}));
vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Map()),
}));

import { prisma } from "@/lib/prisma";
import {
  canCreatePolls,
  isAllowlistEnabled,
  isEmailBlocked,
  isOwnerEmail,
  normalizeEmail,
} from "@/lib/access";

const blockedFindUnique = vi.mocked(prisma.blockedEmail.findUnique);
const allowedFindUnique = vi.mocked(prisma.allowedCreator.findUnique);

// Helper: make the mocked lookups answer "row exists" / "no row".
type FindArg = { where: { email: string } };
function setBlocked(emails: string[]) {
  blockedFindUnique.mockImplementation((async ({ where }: FindArg) =>
    emails.includes(where.email)
      ? { id: "b", email: where.email }
      : null) as never);
}
function setAllowed(emails: string[]) {
  allowedFindUnique.mockImplementation((async ({ where }: FindArg) =>
    emails.includes(where.email)
      ? { id: "a", email: where.email }
      : null) as never);
}

const OWNER = "owner@example.com";

beforeEach(() => {
  vi.clearAllMocks();
  setBlocked([]);
  setAllowed([]);
  process.env.OWNER_EMAIL = OWNER;
  delete process.env.ALLOWLIST_ENABLED; // default = on
});

afterEach(() => {
  delete process.env.OWNER_EMAIL;
  delete process.env.ALLOWLIST_ENABLED;
});

describe("normalizeEmail", () => {
  it("lowercases and trims", () => {
    expect(normalizeEmail("  Foo@Example.COM ")).toBe("foo@example.com");
  });
});

describe("isOwnerEmail", () => {
  it("matches OWNER_EMAIL case-insensitively", () => {
    expect(isOwnerEmail("OWNER@example.com")).toBe(true);
    expect(isOwnerEmail("someone@example.com")).toBe(false);
  });

  it("is false for null/undefined or when OWNER_EMAIL is unset", () => {
    expect(isOwnerEmail(null)).toBe(false);
    delete process.env.OWNER_EMAIL;
    expect(isOwnerEmail(OWNER)).toBe(false);
  });
});

describe("isAllowlistEnabled", () => {
  it("defaults on when unset, and only 'false' turns it off", () => {
    expect(isAllowlistEnabled()).toBe(true);
    process.env.ALLOWLIST_ENABLED = "false";
    expect(isAllowlistEnabled()).toBe(false);
    process.env.ALLOWLIST_ENABLED = "true";
    expect(isAllowlistEnabled()).toBe(true);
  });
});

describe("isEmailBlocked", () => {
  it("is true only for emails on the blocklist; false for empty input", async () => {
    setBlocked(["bad@example.com"]);
    expect(await isEmailBlocked("bad@example.com")).toBe(true);
    expect(await isEmailBlocked("ok@example.com")).toBe(false);
    expect(await isEmailBlocked(null)).toBe(false);
  });

  it("normalizes before lookup", async () => {
    setBlocked(["bad@example.com"]);
    expect(await isEmailBlocked("BAD@Example.com")).toBe(true);
  });
});

describe("canCreatePolls — access matrix", () => {
  it("denies a null/empty email", async () => {
    expect(await canCreatePolls(null)).toBe(false);
  });

  describe("owner", () => {
    it("always passes — even when on the blocklist", async () => {
      setBlocked([OWNER]);
      expect(await canCreatePolls(OWNER)).toBe(true);
    });

    it("passes regardless of allowlist mode without an AllowedCreator row", async () => {
      process.env.ALLOWLIST_ENABLED = "true";
      expect(await canCreatePolls(OWNER)).toBe(true);
    });
  });

  describe("non-owner, allowlist ON", () => {
    beforeEach(() => {
      process.env.ALLOWLIST_ENABLED = "true";
    });

    it("allows an allowlisted, non-blocked user", async () => {
      setAllowed(["friend@example.com"]);
      expect(await canCreatePolls("friend@example.com")).toBe(true);
    });

    it("denies a non-allowlisted user", async () => {
      expect(await canCreatePolls("stranger@example.com")).toBe(false);
    });

    it("denies a blocked user even if allowlisted", async () => {
      setAllowed(["friend@example.com"]);
      setBlocked(["friend@example.com"]);
      expect(await canCreatePolls("friend@example.com")).toBe(false);
    });
  });

  describe("non-owner, allowlist OFF", () => {
    beforeEach(() => {
      process.env.ALLOWLIST_ENABLED = "false";
    });

    it("allows any non-blocked verified user (no list consulted)", async () => {
      expect(await canCreatePolls("anyone@example.com")).toBe(true);
      expect(allowedFindUnique).not.toHaveBeenCalled();
    });

    it("still denies a blocked user", async () => {
      setBlocked(["bad@example.com"]);
      expect(await canCreatePolls("bad@example.com")).toBe(false);
    });
  });
});
