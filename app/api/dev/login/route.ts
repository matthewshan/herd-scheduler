import { randomBytes } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  isEmailBlocked,
  isOwnerEmail,
  logAction,
  normalizeEmail,
} from "@/lib/access";

// Dev-only sign-in bypass for local testing without the Google round-trip.
// Because we use database sessions, "signing in" is just a Session row + the
// Auth.js session cookie — no Credentials provider needed (which would force
// JWT sessions and conflict with the OAuth flow).
//
// TRIPLE-GATED so it can never run in a real deployment:
//   1. NODE_ENV must not be "production"
//   2. ENABLE_DEV_LOGIN must equal "true"
//   3. it lives under /api/dev and is documented as throwaway
//
// Usage: GET /api/dev/login?email=you@example.com[&name=You][&callbackUrl=/admin]

export const runtime = "nodejs";

// Auth.js v5 names the DB-session cookie this in a non-secure (http) context.
const SESSION_COOKIE = "authjs.session-token";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

function devLoginEnabled(): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.ENABLE_DEV_LOGIN === "true"
  );
}

export async function GET(req: NextRequest) {
  if (!devLoginEnabled()) {
    return new NextResponse("Not found", { status: 404 });
  }

  const url = new URL(req.url);
  const emailParam = url.searchParams.get("email");
  if (!emailParam) {
    return NextResponse.json(
      { error: "email query param required" },
      { status: 400 },
    );
  }
  const email = normalizeEmail(emailParam);
  const name = url.searchParams.get("name") ?? email.split("@")[0];
  const callbackUrl = url.searchParams.get("callbackUrl") ?? "/";

  // Mirror the real signIn gate so the blocklist is testable through here too.
  if (await isEmailBlocked(email)) {
    return NextResponse.json(
      { error: "email is blocked" },
      { status: 403 },
    );
  }

  const owner = isOwnerEmail(email);
  const user = await prisma.user.upsert({
    where: { email },
    create: { email, name, emailVerified: new Date(), isOwner: owner },
    // Keep a returning bypass user verified too (the real signIn gate requires
    // it); set isOwner when the email matches OWNER_EMAIL.
    update: { emailVerified: new Date(), ...(owner ? { isOwner: true } : {}) },
  });
  if (owner) {
    await prisma.allowedCreator.upsert({
      where: { email },
      create: { email, addedBy: "system:dev-login" },
      update: {},
    });
  }

  const sessionToken = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + MAX_AGE_SECONDS * 1000);
  await prisma.session.create({
    data: { sessionToken, userId: user.id, expires },
  });

  await logAction({
    action: "signin",
    actorUserId: user.id,
    actorEmail: email,
    metadata: { via: "dev-login" },
  });

  const res = NextResponse.redirect(new URL(callbackUrl, url.origin));
  res.cookies.set(SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: false,
    expires,
  });
  return res;
}
