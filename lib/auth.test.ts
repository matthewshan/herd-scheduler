import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Owner authorization must derive from OWNER_EMAIL only — never the DB
// `isOwner` mirror, which can go stale when OWNER_EMAIL changes.
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((to: string) => {
    throw new Error(`REDIRECT:${to}`);
  }),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    blockedEmail: { findUnique: vi.fn() },
    allowedCreator: { findUnique: vi.fn() },
  },
}));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Map()) }));

import { auth } from "@/auth";
import { getSessionUser, requireOwner } from "@/lib/auth";

const mockAuth = vi.mocked(auth as unknown as () => Promise<unknown>);

function signedInAs(email: string, isOwnerFlag: boolean) {
  mockAuth.mockResolvedValue({
    user: { id: "u1", email, name: "U", image: null, isOwner: isOwnerFlag },
    expires: "",
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.OWNER_EMAIL = "owner@example.com";
});

afterEach(() => {
  delete process.env.OWNER_EMAIL;
});

describe("requireOwner", () => {
  it("lets in the OWNER_EMAIL user even without the DB flag", async () => {
    signedInAs("Owner@Example.com", false);
    await expect(requireOwner()).resolves.toMatchObject({ isOwner: true });
  });

  it("sends a stale former owner (DB flag still true) home", async () => {
    signedInAs("old-owner@example.com", true);
    await expect(requireOwner()).rejects.toThrow("REDIRECT:/");
  });

  it("sends signed-out visitors to sign-in", async () => {
    mockAuth.mockResolvedValue(null);
    await expect(requireOwner()).rejects.toThrow("REDIRECT:/signin");
  });
});

describe("getSessionUser", () => {
  it("re-derives isOwner from OWNER_EMAIL, ignoring the session flag", async () => {
    signedInAs("old-owner@example.com", true);
    expect((await getSessionUser())?.isOwner).toBe(false);
    signedInAs("owner@example.com", false);
    expect((await getSessionUser())?.isOwner).toBe(true);
  });
});
