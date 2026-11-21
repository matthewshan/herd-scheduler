/**
 * Visual capture — drives the real app with Playwright and renders the flows as
 * optimized GIFs for the docs (the "context engineering" media described in
 * docs/context-engineering/visual-capture.md).
 *
 * Why this exists: a GIF of the actual rendered flow is denser, higher-signal
 * context than prose for both reviewers and future agents — it shows the design
 * bundle was matched and the flow actually works. Capturing it from Playwright
 * (rather than hand-recording) makes it cheap to re-run every phase.
 *
 * Usage (app + Postgres must already be running — see the doc):
 *   ENABLE_DEV_LOGIN=true pnpm capture:visual
 *
 * Pipeline: Playwright records each scenario to webm → ffmpeg builds a palette
 * and converts to a small, sharp GIF in docs/screenshots/phase-5/.
 *
 * Why `.mts`: this is a standalone ESM script (top-level `import`s, run via
 * `tsx`), but the package has no `"type": "module"`, so it defaults to CommonJS.
 * The `.mts` extension marks this one file as an ES module regardless, so node
 * and `tsx` resolve it as ESM without flipping the whole package over.
 */
import {
  chromium,
  type BrowserContextOptions,
  type Page,
} from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.CAPTURE_BASE_URL ?? "http://localhost:3000";
const OWNER = process.env.OWNER_EMAIL ?? "matthewshan99@gmail.com";
// Output GIFs are grouped by phase: docs/screenshots/phase-<n>/. Work that isn't
// a phase (e.g. the Nov 2026 bug-fix pass) passes a name: docs/screenshots/<name>/.
const outDir = (phase: number | string) =>
  typeof phase === "number"
    ? `docs/screenshots/phase-${phase}`
    : `docs/screenshots/${phase}`;
// `CAPTURE_SET=bug-fixes` records only the bug-fix-pass scenarios; unset runs
// the phase scenarios (5–12).
const CAPTURE_SET = process.env.CAPTURE_SET ?? "phases";
const TMP_DIR = ".capture-tmp";

// Phone-width viewport so the centered max-w-[390px] screens nearly fill the
// frame. GIF is lightly downscaled from this in ffmpeg.
const VIEWPORT = { width: 440, height: 920 };
const GIF_WIDTH = 420;
const FPS = 13;

const wait = (page: Page, ms: number) => page.waitForTimeout(ms);

/** Authenticate the context as the owner via the dev-login bypass, landing on `to`. */
async function devLogin(page: Page, to: string): Promise<void> {
  const url = `${BASE}/api/dev/login?email=${encodeURIComponent(
    OWNER,
  )}&name=Alex&callbackUrl=${encodeURIComponent(to)}`;
  await page.goto(url, { waitUntil: "networkidle" });
}

/** Convert the scenario's recorded webm into an optimized GIF. */
function webmToGif(webmPath: string, gifPath: string): void {
  const filters = [
    `fps=${FPS}`,
    `scale=${GIF_WIDTH}:-1:flags=lanczos`,
    "split[s0][s1]",
    "[s0]palettegen=max_colors=128[p]",
    "[s1][p]paletteuse=dither=bayer:bayer_scale=3",
  ].join(",");
  // Resolve ffmpeg from $FFMPEG when set, else the one on PATH. This lets
  // platforms without a full system ffmpeg (e.g. Windows N editions, where the
  // only build around is Playwright's stripped one missing palettegen) point at
  // a local static build without putting it on PATH.
  const ffmpeg = process.env.FFMPEG ?? "ffmpeg";
  execFileSync(ffmpeg, ["-y", "-i", webmPath, "-vf", filters, gifPath], {
    stdio: "ignore",
  });
}

interface Recorded<T> {
  result: T;
}

/** Run one scenario in its own recorded context, then emit the GIF. */
async function record<T>(
  browser: import("@playwright/test").Browser,
  phase: number | string,
  name: string,
  colorScheme: "light" | "dark",
  fn: (page: Page) => Promise<T>,
  // Extra context options (e.g. `timezoneId`) for scenarios that need them.
  contextOptions: BrowserContextOptions = {},
): Promise<Recorded<T>> {
  const videoDir = join(TMP_DIR, name);
  const context = await browser.newContext({
    ...contextOptions,
    viewport: VIEWPORT,
    colorScheme,
    // The share screen copies the poll link to the clipboard; grant the
    // permission so the capture doesn't trip an unhandled clipboard rejection.
    permissions: ["clipboard-write"],
    // Video size MUST equal the viewport: Chromium records at CSS resolution and
    // pins the page to the top-left of a larger frame, so an oversized size (e.g.
    // for deviceScaleFactor) leaves the page in a corner with empty padding.
    recordVideo: { dir: videoDir, size: VIEWPORT },
  });
  const page = await context.newPage();
  let result: T;
  try {
    result = await fn(page);
  } finally {
    await context.close(); // flushes the webm to disk
  }
  const webm = readdirSync(videoDir).find((f) => f.endsWith(".webm"));
  if (!webm) throw new Error(`No video recorded for "${name}"`);
  const dir = outDir(phase);
  mkdirSync(dir, { recursive: true });
  webmToGif(join(videoDir, webm), join(dir, `${name}.gif`));
  console.log(`✓ ${dir}/${name}.gif`);
  return { result };
}

/** Fill + submit the create form. Returns the created poll's slug. */
async function driveCreate(page: Page): Promise<string> {
  await devLogin(page, "/create");
  await page.waitForSelector("#poll-title");
  await wait(page, 500);

  await page.locator("#poll-title").pressSequentially("Game night 🎲", {
    delay: 45,
  });
  await page
    .locator("#poll-desc")
    .pressSequentially("Bringing snacks — just need a night that works.", {
      delay: 18,
    });
  await page.locator("#poll-loc").pressSequentially("Alex's place", {
    delay: 25,
  });
  await wait(page, 400);

  // Move to next month so the hard-coded day numbers are always in the future,
  // regardless of what day the capture runs (past days render disabled).
  await page.getByRole("button", { name: "Next month" }).click();
  await wait(page, 350);

  // Pick a few days, then add them at the default 7:00 PM–10:00 PM range.
  for (const day of ["12", "13", "19"]) {
    await page.getByRole("button", { name: day, exact: true }).click();
    await wait(page, 220);
  }
  await wait(page, 300);
  await page.getByRole("button", { name: /^Add \d+ days at/ }).click();
  await wait(page, 700);

  // A second batch at a different time, to show the sticky range changing.
  await page.getByRole("button", { name: "26", exact: true }).click();
  await page.getByLabel("Start time").selectOption("6:00 PM");
  await page.getByLabel("End time").selectOption("9:00 PM");
  await wait(page, 300);
  await page.getByRole("button", { name: /^Add \d+ day at/ }).click();
  await wait(page, 700);

  // Show the anonymity toggle.
  await page.getByRole("switch", { name: "Anonymous responses" }).click();
  await wait(page, 500);
  await page.getByRole("switch", { name: "Anonymous responses" }).click();
  await wait(page, 400);

  await page.getByRole("button", { name: "Create poll" }).click();
  await page.waitForSelector("text=Poll created");
  await wait(page, 700);
  await page.getByRole("button", { name: /Copy link/ }).click();
  await wait(page, 1200);

  // The share box renders the absolute URL; pull the slug from it.
  const shareText = await page.getByText(/\/p\//).first().innerText();
  const slug = shareText.split("/p/")[1].trim();
  return slug;
}

async function driverPollPage(page: Page, slug: string): Promise<void> {
  await page.goto(`${BASE}/p/${slug}`, { waitUntil: "networkidle" });
  await wait(page, 900);
  // A gentle scroll through the listed times.
  await page.mouse.wheel(0, 260);
  await wait(page, 900);
  await page.mouse.wheel(0, 260);
  await wait(page, 1000);
}

/**
 * Vote as a guest (Phase 6): name yourself, mark availability per slot on the
 * 3-way Segmented control, then submit to the "Saved" toast. The context is
 * fresh (no dev-login cookie), so this is the unauthenticated guest path — the
 * name input and inline sign-in affordance are both visible.
 */
async function driveVote(page: Page, slug: string): Promise<void> {
  await page.goto(`${BASE}/p/${slug}`, { waitUntil: "networkidle" });
  await page.waitForSelector("text=Which times work for you?");
  await wait(page, 800);

  await page.getByLabel("Your name").pressSequentially("Sam", { delay: 70 });
  await wait(page, 500);

  // Each SlotCard holds one Segmented (a "Your availability" radiogroup). Mark
  // each in turn; Playwright scrolls the slot into view before clicking.
  const groups = page.getByRole("radiogroup", { name: "Your availability" });
  const picks = ["Yes", "Yes", "If-need-be", "No"];
  const count = await groups.count();
  for (let i = 0; i < count; i++) {
    const choice = picks[i % picks.length];
    await groups
      .nth(i)
      .getByRole("radio", { name: choice, exact: true })
      .click();
    await wait(page, 380);
  }
  await wait(page, 600);

  // Submit → the bar collapses to the "Saved — you can update anytime" toast.
  await page.getByRole("button", { name: /Submit availability/ }).click();
  await page.waitForSelector("text=Saved");
  await wait(page, 1400);
}

/** Run a non-recorded context (for seeding data — votes, extra polls). */
async function plain<T>(
  browser: import("@playwright/test").Browser,
  fn: (page: Page) => Promise<T>,
): Promise<T> {
  const context = await browser.newContext({
    viewport: VIEWPORT,
    permissions: ["clipboard-write"],
  });
  const page = await context.newPage();
  try {
    return await fn(page);
  } finally {
    await context.close();
  }
}

/**
 * Cast a guest ballot on a poll (data-seeding; no recording, minimal waits).
 * A `null` pick leaves that slot unmarked.
 */
async function voteAs(
  page: Page,
  slug: string,
  name: string,
  picks: (string | null)[],
): Promise<void> {
  await page.goto(`${BASE}/p/${slug}`, { waitUntil: "networkidle" });
  await page.waitForSelector("text=Which times work for you?");
  await page.getByLabel("Your name").fill(name);
  const groups = page.getByRole("radiogroup", { name: "Your availability" });
  const count = await groups.count();
  for (let i = 0; i < count; i++) {
    const pick = picks[i % picks.length];
    if (pick === null) {
      continue;
    }
    await groups.nth(i).getByRole("radio", { name: pick, exact: true }).click();
  }
  await page.getByRole("button", { name: /Submit availability/ }).click();
  await page.waitForSelector("text=Saved");
}

/** Quickly create a poll as the owner (data-seeding). Returns the slug. */
async function quickCreate(
  page: Page,
  title: string,
  days: string[],
): Promise<string> {
  await devLogin(page, "/create");
  await page.waitForSelector("#poll-title");
  await page.locator("#poll-title").fill(title);
  await page.getByRole("button", { name: "Next month" }).click();
  for (const day of days) {
    await page.getByRole("button", { name: day, exact: true }).click();
  }
  await page.getByRole("button", { name: /^Add \d+ days? at/ }).click();
  await page.getByRole("button", { name: "Create poll" }).click();
  await page.waitForSelector("text=Poll created");
  const shareText = await page.getByText(/\/p\//).first().innerText();
  return shareText.split("/p/")[1].trim();
}

/**
 * Results + finalize (Phase 7): the host opens the best-fit-sorted breakdown and
 * finalizes the winning slot, surfacing the "Finalized" banner + per-card pill.
 */
async function driveResults(page: Page, slug: string): Promise<void> {
  await devLogin(page, `/p/${slug}/results`);
  await page.waitForSelector("text=Sorted by best fit");
  await wait(page, 1100);
  await page.mouse.wheel(0, 240);
  await wait(page, 850);
  await page.mouse.wheel(0, -240);
  await wait(page, 600);

  // Finalize the top (best-fit) slot → banner + pill appear.
  await page
    .getByRole("button", { name: "Finalize this time" })
    .first()
    .click();
  await page.waitForSelector("text=Final pick & other options");
  await wait(page, 1500);
  await page.mouse.wheel(0, 260);
  await wait(page, 1100);
}

/**
 * Results as a guest (Phase 7 refinement): an unauthenticated viewer opens a
 * still-open poll's results and sees the "Submit yours" CTA in the section
 * header — their way to the vote screen. The context has no dev-login cookie,
 * so `viewerHasVoted` is false and the link reads "Submit yours".
 */
async function driveResultsGuest(page: Page, slug: string): Promise<void> {
  await page.goto(`${BASE}/p/${slug}/results`, { waitUntil: "networkidle" });
  await page.waitForSelector("text=Sorted by best fit");
  await wait(page, 900);
  await page
    .getByRole("link", { name: /Submit yours/ })
    .scrollIntoViewIfNeeded();
  await wait(page, 1400);
  await page.mouse.wheel(0, 220);
  await wait(page, 1000);
}

/**
 * Creator home (Phase 8): the host's "Your polls" list — varied rows (a
 * finalized poll, a leading one, one awaiting its first reply) and a copy-link.
 */
async function driveMyPolls(page: Page): Promise<void> {
  await devLogin(page, "/");
  await page.waitForSelector("text=Your polls");
  await wait(page, 1100);
  await page.mouse.wheel(0, 200);
  await wait(page, 900);
  await page
    .getByRole("button", { name: /Copy link/ })
    .first()
    .click();
  await wait(page, 1500);
  await page.mouse.wheel(0, 200);
  await wait(page, 900);
}

/**
 * Delete a poll from the creator home (Phase 8): the trash action reveals an
 * inline "Delete this poll?" confirm, and confirming collapses the card out with
 * the grid-rows height + fade animation as the rows below slide up.
 */
async function driveDelete(page: Page): Promise<void> {
  await devLogin(page, "/");
  await page.waitForSelector("text=Your polls");
  await wait(page, 1000);
  // Reveal the two-step confirm on the first card.
  await page.getByRole("button", { name: "Delete poll" }).first().click();
  await wait(page, 1100);
  // Confirm → the card animates out (collapse + fade), list reflows.
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page.waitForSelector("text=Deleting…").catch(() => {});
  await wait(page, 1800);
}

/**
 * Persistent guest identity (Phase 9): a guest votes, leaves, and returns to
 * the same poll on the same browser — their name is pre-filled, their saved
 * ballot is hydrated, and re-submitting EDITS their vote (the bar reads
 * "Update availability"), with the quiet "Not you? Start fresh" escape hatch
 * visible. One recorded context = one browser, so localStorage (the durable
 * guest identity) survives the leave-and-return navigation.
 */
async function driveGuestReturn(page: Page, slug: string): Promise<void> {
  // First visit: vote as Priya.
  await page.goto(`${BASE}/p/${slug}`, { waitUntil: "networkidle" });
  await page.waitForSelector("text=Which times work for you?");
  await wait(page, 700);
  await page.getByLabel("Your name").pressSequentially("Priya", { delay: 70 });
  await wait(page, 400);
  const groups = page.getByRole("radiogroup", { name: "Your availability" });
  const picks = ["Yes", "No", "Yes"];
  const count = await groups.count();
  for (let i = 0; i < count; i++) {
    await groups
      .nth(i)
      .getByRole("radio", { name: picks[i % picks.length], exact: true })
      .click();
    await wait(page, 350);
  }
  await wait(page, 400);
  await page.getByRole("button", { name: /Submit availability/ }).click();
  await page.waitForSelector("text=Saved");
  await wait(page, 1300);

  // "Close the tab and come back": a fresh load of the same poll. The stored
  // guest key recognizes Priya — name pre-filled, saved ballot hydrated, and
  // the shared-device escape hatch shows.
  await page.goto("about:blank");
  await wait(page, 500);
  await page.goto(`${BASE}/p/${slug}`, { waitUntil: "networkidle" });
  await page.waitForSelector("text=Not you? Start fresh");
  await wait(page, 1600);

  // Change one answer → submit reads "Update availability" and edits the same
  // participant (no duplicate responder in the results).
  await groups
    .first()
    .getByRole("radio", { name: "If-need-be", exact: true })
    .click();
  await wait(page, 700);
  await page.getByRole("button", { name: /Update availability/ }).click();
  await page.waitForSelector("text=Saved");
  await wait(page, 1500);
}

/**
 * Guest → account claim (Phase 12): a guest votes, then signs in via the inline
 * affordance, and their guest ballot is adopted into the account — it stays
 * marked and the submit bar reads "Update availability" (not a fresh "Submit").
 * Sign-in is the dev-login bypass standing in for the Google OAuth round-trip;
 * crucially it's the *same* browser context, so the localStorage guestKey
 * survives and the on-mount claim rebinds the guest's participation to the user.
 */
async function driveGuestClaim(page: Page, slug: string): Promise<void> {
  // First: vote as a guest (Dana).
  await page.goto(`${BASE}/p/${slug}`, { waitUntil: "networkidle" });
  await page.waitForSelector("text=Which times work for you?");
  await wait(page, 700);
  await page.getByLabel("Your name").pressSequentially("Dana", { delay: 70 });
  await wait(page, 400);
  const groups = page.getByRole("radiogroup", { name: "Your availability" });
  const picks = ["Yes", "If-need-be", "Yes"];
  const count = await groups.count();
  for (let i = 0; i < count; i++) {
    await groups
      .nth(i)
      .getByRole("radio", { name: picks[i % picks.length], exact: true })
      .click();
    await wait(page, 350);
  }
  await wait(page, 400);
  await page.getByRole("button", { name: /Submit availability/ }).click();
  await page.waitForSelector("text=Saved");
  await wait(page, 1400);

  // Now sign in through the inline Google affordance (Google stubbed to the
  // dev-login bypass) and return to the same poll. The account adopts the guest
  // ballot: the answers stay marked and the bar flips to "Update availability".
  // Claiming only fires on this guest → sign-in hop (the inline button sets the
  // one-shot `herd-guest-claim` marker), so a bare dev-login wouldn't claim.
  await signInViaGoogle(page, "dana@example.com", "Dana Lee", `/p/${slug}`);
  await page.waitForSelector("text=Which times work for you?");
  await page.waitForSelector("text=Update availability");
  await wait(page, 1900);
}

/**
 * Click the vote screen's inline "Sign in" (Google) button, with Google's
 * authorize page stubbed to redirect into the dev-login bypass. The app's own
 * code runs exactly as in production up to the OAuth hop — including setting
 * the pending-claim marker — so this exercises the real guest → sign-in path.
 */
async function signInViaGoogle(
  page: Page,
  email: string,
  name: string,
  to: string,
): Promise<void> {
  const devLogin = `${BASE}/api/dev/login?email=${encodeURIComponent(
    email,
  )}&name=${encodeURIComponent(name)}&callbackUrl=${encodeURIComponent(to)}`;
  await page
    .context()
    .route("https://accounts.google.com/**", (route) =>
      route.fulfill({ status: 302, headers: { location: devLogin } }),
    );
  await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/dev/login")),
    page.getByRole("button", { name: "Sign in", exact: true }).click(),
  ]);
  await page.waitForLoadState("networkidle");
}

/** Sign out through Auth.js's sign-out page. */
async function signOut(page: Page): Promise<void> {
  await page.goto(`${BASE}/api/auth/signout`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /sign out/i }).click();
  await page.waitForLoadState("networkidle");
}

/** Owner adds (or removes) an approved creator on /admin (data-seeding). */
async function setApprovedCreator(
  page: Page,
  email: string,
  approved: boolean,
): Promise<void> {
  await devLogin(page, "/admin");
  await page.waitForSelector("text=Approved creators");
  // The remove button is the row's unique handle (the audit log below can
  // mention the same email).
  const remove = page.getByRole("button", { name: `Remove ${email}` });
  if (approved) {
    await page.getByLabel("Email to approve").fill(email);
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await remove.waitFor();
  } else {
    await remove.click();
    await remove.waitFor({ state: "detached" });
  }
}

/**
 * As the owner, re-answer an existing ballot on a poll (e.g. the host's
 * auto-Yes from creation). A pick re-clicks that answer; `"clear"` taps the
 * currently selected answer to clear the slot.
 */
async function editOwnerBallot(
  page: Page,
  slug: string,
  picks: ("Yes" | "If-need-be" | "No" | "clear")[],
): Promise<void> {
  await devLogin(page, `/p/${slug}`);
  await page.waitForSelector("text=Update availability");
  const groups = page.getByRole("radiogroup", { name: "Your availability" });
  for (let i = 0; i < picks.length; i++) {
    const group = groups.nth(i);
    if (picks[i] === "clear") {
      await group.locator('[role="radio"][aria-checked="true"]').click();
    } else {
      await group.getByRole("radio", { name: picks[i], exact: true }).click();
    }
  }
  await page.getByRole("button", { name: /Update availability/ }).click();
  await page.waitForSelector("text=Saved");
}

/** Authenticate as an arbitrary dev-login identity (not just the owner). */
async function devLoginAs(
  page: Page,
  email: string,
  name: string,
  to: string,
  image?: string,
): Promise<void> {
  const img = image ? `&image=${encodeURIComponent(image)}` : "";
  const url = `${BASE}/api/dev/login?email=${encodeURIComponent(
    email,
  )}&name=${encodeURIComponent(name)}${img}&callbackUrl=${encodeURIComponent(
    to,
  )}`;
  await page.goto(url, { waitUntil: "networkidle" });
}

// Deterministic, public stand-in photos for the profile-picture flow (the
// dev-login bypass has no Google image). Realistic faces so the avatar stack
// reads as real profile pictures.
const AVATAR = (n: number) => `https://i.pravatar.cc/150?img=${n}`;

/**
 * Create a poll as a specific dev-login host (data-seeding). Used to seed a poll
 * owned by someone *other* than the owner, so the owner's "Joined" tab has a row.
 * Needs ALLOWLIST_ENABLED=false for a non-owner to pass requireCreator.
 */
async function quickCreateAs(
  page: Page,
  email: string,
  name: string,
  title: string,
  days: string[],
): Promise<string> {
  await devLoginAs(page, email, name, "/create");
  await page.waitForSelector("#poll-title");
  await page.locator("#poll-title").fill(title);
  await page.getByRole("button", { name: "Next month" }).click();
  for (const day of days) {
    await page.getByRole("button", { name: day, exact: true }).click();
  }
  await page.getByRole("button", { name: /^Add \d+ days? at/ }).click();
  await page.getByRole("button", { name: "Create poll" }).click();
  await page.waitForSelector("text=Poll created");
  const shareText = await page.getByText(/\/p\//).first().innerText();
  return shareText.split("/p/")[1].trim();
}

/** Cast a ballot while signed in as a specific user (no guest name field). */
async function voteAsUser(
  page: Page,
  email: string,
  name: string,
  slug: string,
  picks: string[],
  image?: string,
): Promise<void> {
  await devLoginAs(page, email, name, `/p/${slug}`, image);
  await page.waitForSelector("text=Which times work for you?");
  const groups = page.getByRole("radiogroup", { name: "Your availability" });
  const count = await groups.count();
  for (let i = 0; i < count; i++) {
    await groups
      .nth(i)
      .getByRole("radio", { name: picks[i % picks.length], exact: true })
      .click();
  }
  await page.getByRole("button", { name: /Submit availability/ }).click();
  await page.waitForSelector("text=Saved");
}

/**
 * Profile pictures + name reveal: signed-in voters carry their Google photo into
 * the vote-screen identity row and the results avatar stacks (guests fall back to
 * the initial circle). On the results screen, hovering an avatar reveals whose it
 * is (a name bubble); tapping pins it for touch. Records a photo-carrying user
 * voting, then opening the results and revealing names on the stack.
 */
async function driveProfileAvatars(page: Page, slug: string): Promise<void> {
  // Sign in WITH a profile photo and land on the vote screen — the identity row
  // shows the avatar (not the initial fallback).
  await devLoginAs(
    page,
    "jordan@example.com",
    "Jordan",
    `/p/${slug}`,
    AVATAR(5),
  );
  await page.waitForSelector("text=Which times work for you?");
  await wait(page, 1200);

  const groups = page.getByRole("radiogroup", { name: "Your availability" });
  const picks = ["Yes", "Yes", "If-need-be"];
  const count = await groups.count();
  for (let i = 0; i < count; i++) {
    await groups
      .nth(i)
      .getByRole("radio", { name: picks[i % picks.length], exact: true })
      .click();
    await wait(page, 380);
  }
  await wait(page, 500);
  await page.getByRole("button", { name: /availability/ }).click();
  await page.waitForSelector("text=Saved");
  await wait(page, 1100);

  // Open the results — each slot's avatar stack now renders the voters' photos.
  await page.goto(`${BASE}/p/${slug}/results`, { waitUntil: "networkidle" });
  await page.waitForSelector("text=Sorted by best fit");
  await wait(page, 1300);
  await page.mouse.wheel(0, 200);
  await wait(page, 1100);

  // Reveal whose avatar is whose: hovering shows the name bubble (desktop),
  // tapping pins it (touch). Demonstrated on the best-fit slot's stack.
  const priya = page
    .getByRole("button", { name: "Priya", exact: true })
    .first();
  await priya.scrollIntoViewIfNeeded();
  await wait(page, 400);
  await priya.hover();
  await wait(page, 1400);
  const marcus = page
    .getByRole("button", { name: "Marcus", exact: true })
    .first();
  await marcus.hover();
  await wait(page, 1400);
  // Tap to pin the name (the touch path), then move away.
  await marcus.click();
  await wait(page, 1300);
  await page.mouse.move(8, 8);
  await wait(page, 900);
}

/**
 * The Nov 2026 bug-fix pass (branch `bug-fixes`, PRs #17–#23), output to
 * docs/screenshots/bug-fixes/. Assumes ALLOWLIST_ENABLED=true (the
 * de-allowlisted-host flow needs the allowlist on) and a server running in UTC
 * (`TZ=UTC`, like the production container) for the create-calendar flow.
 */
async function captureBugFixes(
  browser: import("@playwright/test").Browser,
): Promise<void> {
  const PASS = "bug-fixes";

  // #17 — a 150+ char title no longer drops the poll from the guest home.
  const longTitle =
    "Planning the big end-of-year team offsite: dinner, bowling, karaoke, " +
    "a long walk along the river, and then dessert somewhere that stays open really late 🎳";
  const longSlug = await plain(browser, (p) =>
    quickCreate(p, longTitle, ["10", "11"]),
  );
  await record(
    browser,
    PASS,
    "guest-home-long-title",
    "light",
    async (page) => {
      await page.goto(`${BASE}/p/${longSlug}`, { waitUntil: "networkidle" });
      await page.waitForSelector("text=Which times work for you?");
      await wait(page, 1300);
      await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
      await page
        .getByText(/Planning the big end-of-year/)
        .first()
        .waitFor();
      await wait(page, 2600);
    },
  );

  // #18 — a host removed from approved creators keeps their polls; only the
  // New poll button goes, replaced by an "ask {owner}" line.
  const HOST = "jamie@example.com";
  await plain(browser, (p) => setApprovedCreator(p, HOST, true));
  await plain(browser, (p) =>
    quickCreateAs(p, HOST, "Jamie", "Jamie's climbing session 🧗", ["5", "6"]),
  );
  await record(browser, PASS, "deallowlisted-host", "light", async (page) => {
    await devLoginAs(page, HOST, "Jamie", "/");
    await page.waitForSelector("text=Your polls");
    await page.getByRole("button", { name: "New poll" }).waitFor();
    await wait(page, 1800);
    // Meanwhile the owner removes Jamie from approved creators on /admin.
    await plain(browser, (p) => setApprovedCreator(p, HOST, false));
    await page.reload({ waitUntil: "networkidle" });
    await page.getByText(/Ask Alex to add you/).waitFor();
    await wait(page, 2800);
  });
  await record(browser, PASS, "admin-blocklist-copy", "light", async (page) => {
    await devLogin(page, "/admin");
    await page.waitForSelector("text=Blocked emails");
    await page.getByText(/signed out right away/).scrollIntoViewIfNeeded();
    await wait(page, 2600);
  });

  // #20 — best fit only for slots ≥1 person can make. Slot 1: Alice Yes, Bob
  // No, host No (score −5). Slot 2: nobody marked it (score 0) — it used to win.
  const bestSlug = await plain(browser, (p) =>
    quickCreate(p, "Board game brunch", ["13", "14"]),
  );
  await plain(browser, (p) => editOwnerBallot(p, bestSlug, ["No", "clear"]));
  await plain(browser, (p) => voteAs(p, bestSlug, "Alice", ["Yes", null]));
  await plain(browser, (p) => voteAs(p, bestSlug, "Bob", ["No", null]));
  await record(browser, PASS, "best-fit-eligible", "light", async (page) => {
    await page.goto(`${BASE}/p/${bestSlug}/results`, {
      waitUntil: "networkidle",
    });
    await page.waitForSelector("text=Sorted by best fit");
    await wait(page, 1800);
    await page.mouse.wheel(0, 260);
    await wait(page, 1600);
    await page.mouse.wheel(0, -260);
    await wait(page, 800);
  });

  // #20 — results for a host with no name: no "Hosted by" line (and never the
  // host's email).
  const NAMELESS = "nameless-host@example.com";
  await plain(browser, (p) => setApprovedCreator(p, NAMELESS, true));
  const namelessSlug = await plain(browser, (p) =>
    quickCreateAs(p, NAMELESS, "", "Pottery class", ["7", "8"]),
  );
  await record(browser, PASS, "results-no-host-name", "light", async (page) => {
    await page.goto(`${BASE}/p/${namelessSlug}/results`, {
      waitUntil: "networkidle",
    });
    await page.waitForSelector("text=Sorted by best fit");
    await wait(page, 2600);
  });

  // #20 — creator home card for a poll where nobody can make any slot. Created
  // last so it tops Alex's list.
  const allNoSlug = await plain(browser, (p) =>
    quickCreate(p, "Sunrise hike 🌄", ["20", "21"]),
  );
  await plain(browser, (p) => editOwnerBallot(p, allNoSlug, ["No", "No"]));
  await plain(browser, (p) => voteAs(p, allNoSlug, "Riley", ["No", "No"]));
  await record(browser, PASS, "home-no-time-works", "light", async (page) => {
    await devLogin(page, "/");
    await page.waitForSelector("text=No time works for anyone yet");
    await wait(page, 2800);
  });

  // #21 — claiming happens only on a fresh guest → sign-in hop, and the guest
  // identity is forgotten afterwards; signing out and back in claims nothing.
  const claimSlug = await plain(browser, (p) =>
    quickCreate(p, "Casey's book swap 📚", ["15", "16"]),
  );
  await record(browser, PASS, "claim-on-sign-in", "light", async (page) => {
    await page.goto(`${BASE}/p/${claimSlug}`, { waitUntil: "networkidle" });
    await page.waitForSelector("text=Which times work for you?");
    await wait(page, 600);
    await page.getByLabel("Your name").pressSequentially("Casey", {
      delay: 70,
    });
    const groups = page.getByRole("radiogroup", { name: "Your availability" });
    for (const [i, pick] of ["Yes", "If-need-be"].entries()) {
      await groups
        .nth(i)
        .getByRole("radio", { name: pick, exact: true })
        .click();
      await wait(page, 350);
    }
    await page.getByRole("button", { name: /Submit availability/ }).click();
    await page.waitForSelector("text=Saved");
    await wait(page, 1200);
    // Inline Sign in → back on the poll, signed in, ballot claimed.
    await signInViaGoogle(
      page,
      "casey@example.com",
      "Casey",
      `/p/${claimSlug}`,
    );
    await page.waitForSelector("text=Update availability");
    await wait(page, 2000);
    // Sign out: the guest identity was forgotten, so the device is clean.
    await signOut(page);
    await page.goto(`${BASE}/p/${claimSlug}`, { waitUntil: "networkidle" });
    await page.waitForSelector("text=Which times work for you?");
    await wait(page, 1800);
    // Sign back in and open the results: Casey is one responder, not two.
    await devLoginAs(
      page,
      "casey@example.com",
      "Casey",
      `/p/${claimSlug}/results`,
    );
    await page.waitForSelector("text=Sorted by best fit");
    await wait(page, 2600);
  });

  await record(browser, PASS, "start-fresh", "light", async (page) => {
    await page.goto(`${BASE}/p/${claimSlug}`, { waitUntil: "networkidle" });
    await page.waitForSelector("text=Which times work for you?");
    await page.getByLabel("Your name").fill("Morgan");
    const groups = page.getByRole("radiogroup", { name: "Your availability" });
    await groups.nth(0).getByRole("radio", { name: "No", exact: true }).click();
    await groups
      .nth(1)
      .getByRole("radio", { name: "Yes", exact: true })
      .click();
    await page.getByRole("button", { name: /Submit availability/ }).click();
    await page.waitForSelector("text=Saved");
    await wait(page, 900);
    // Come back on the same device → recognized; "Start fresh" clears it all.
    await page.goto(`${BASE}/p/${claimSlug}`, { waitUntil: "networkidle" });
    await page.waitForSelector("text=Not you? Start fresh");
    await wait(page, 1800);
    await page.getByRole("button", { name: "Not you? Start fresh" }).click();
    await wait(page, 2400);
  });

  // #22 — the create calendar's "today" is the browser's local date. The
  // browser is in Los Angeles at 8 PM on the day before the server's (UTC)
  // date, so the server's provisional today is a day ahead; the calendar
  // re-anchors to the local date and that day stays selectable.
  const utcMidnight = new Date();
  utcMidnight.setUTCHours(0, 0, 0, 0);
  const laEvening = new Date(utcMidnight.getTime() + 4 * 60 * 60 * 1000);
  await record(
    browser,
    PASS,
    "create-local-today",
    "light",
    async (page) => {
      await page.clock.install({ time: laEvening });
      await devLogin(page, "/create");
      await page.waitForSelector("#poll-title");
      await wait(page, 1200);
      const localDay = String(
        Number(
          new Intl.DateTimeFormat("en-US", {
            day: "numeric",
            timeZone: "America/Los_Angeles",
          }).format(laEvening),
        ),
      );
      const today = page.getByRole("button", { name: localDay, exact: true });
      await today.scrollIntoViewIfNeeded();
      await wait(page, 900);
      await today.click();
      await page.getByRole("button", { name: /^Add 1 day at/ }).waitFor();
      await wait(page, 2200);
    },
    { timezoneId: "America/Los_Angeles" },
  );

  // #23 — dark mode sets color-scheme, so native controls (the timezone
  // <select>, scrollbars) render dark too.
  await record(browser, PASS, "create-dark-select", "dark", async (page) => {
    await devLogin(page, "/create");
    await page.waitForSelector("#poll-tz");
    await page.locator("#poll-tz").scrollIntoViewIfNeeded();
    await wait(page, 900);
    await page.locator("#poll-tz").focus();
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press("ArrowDown");
      await wait(page, 650);
    }
    await page.mouse.wheel(0, 300);
    await wait(page, 1400);
  });

  // #23 — rapid share taps keep "Link copied" for the full duration after the
  // last tap (the earlier timer used to cut it short).
  await record(browser, PASS, "share-rapid-taps", "light", async (page) => {
    await page.goto(`${BASE}/p/${claimSlug}`, { waitUntil: "networkidle" });
    await wait(page, 900);
    const share = page.getByRole("button", {
      name: /Share or copy link|Link copied/,
    });
    for (let i = 0; i < 3; i++) {
      await share.click();
      await wait(page, 700);
    }
    await page.waitForSelector("text=Link copied");
    await wait(page, 2400);
  });
}

async function main(): Promise<void> {
  rmSync(TMP_DIR, { recursive: true, force: true });
  mkdirSync(TMP_DIR, { recursive: true });

  const browser = await chromium.launch();
  if (CAPTURE_SET === "bug-fixes") {
    try {
      await captureBugFixes(browser);
    } finally {
      await browser.close();
      rmSync(TMP_DIR, { recursive: true, force: true });
    }
    return;
  }
  try {
    // Phase 5 — create + share. Returns the slug the later flows vote on.
    const { result: slug } = await record(
      browser,
      5,
      "create-flow",
      "light",
      driveCreate,
    );

    await record(browser, 5, "poll-page", "light", (page) =>
      driverPollPage(page, slug),
    );

    // A short dark-mode pass over the create form, for the theme coverage.
    await record(browser, 5, "create-dark", "dark", async (page) => {
      await devLogin(page, "/create");
      await page.waitForSelector("#poll-title");
      await wait(page, 500);
      await page.locator("#poll-title").pressSequentially("Game night 🎲", {
        delay: 40,
      });
      await wait(page, 300);
      await page.getByRole("button", { name: "Next month" }).click();
      await wait(page, 250);
      for (const day of ["12", "13", "19"]) {
        await page.getByRole("button", { name: day, exact: true }).click();
        await wait(page, 200);
      }
      await page.getByRole("button", { name: /^Add \d+ days at/ }).click();
      await wait(page, 1200);
    });

    // Phase 6 — guest vote flow against the poll created above.
    await record(browser, 6, "vote-flow", "light", (page) =>
      driveVote(page, slug),
    );

    // Seed a few more ballots so the results screen has a real breakdown and a
    // clear best-fit winner (4 slots; Sam already voted Yes/Yes/maybe/No above).
    await plain(browser, (p) =>
      voteAs(p, slug, "Jordan", ["Yes", "No", "Yes", "Yes"]),
    );
    await plain(browser, (p) =>
      voteAs(p, slug, "Riley", ["Yes", "Yes", "Yes", "No"]),
    );

    // Two more polls owned by the same host, for the creator-home list: one with
    // a leading slot, one still awaiting its first reply.
    const bookSlug = await plain(browser, (p) =>
      quickCreate(p, "Book club: chapter 4", ["16", "17", "18"]),
    );
    await plain(browser, (p) =>
      voteAs(p, bookSlug, "Sam", ["No", "Yes", "Yes"]),
    );
    await plain(browser, (p) =>
      quickCreate(p, "Marcus's birthday dinner 🎂", ["23", "24"]),
    );

    // Phase 7 — results + finalize (also finalizes the game-night poll, so it
    // shows as "Finalized" on the creator home below).
    await record(browser, 7, "results-finalize", "light", (page) =>
      driveResults(page, slug),
    );

    // Phase 7 refinement — a guest (fresh context, no dev-login) viewing the
    // results of a still-open poll sees a "Submit yours" CTA back to the vote
    // screen. Uses bookSlug (has a real breakdown, not finalized).
    await record(browser, 7, "results-submit-yours", "light", (page) =>
      driveResultsGuest(page, bookSlug),
    );

    // Phase 8 — creator home, light + dark, plus the delete-card animation.
    await record(browser, 8, "my-polls", "light", driveMyPolls);
    await record(browser, 8, "my-polls-dark", "dark", driveMyPolls);
    await record(browser, 8, "delete-poll", "light", driveDelete);

    // Phase 9 — persistent guest identity: vote → leave → return (name +
    // ballot pre-filled) → edit. On its own poll (created after the phase-8
    // recordings so the earlier lists/tallies are unchanged by it).
    const triviaSlug = await plain(browser, (p) =>
      quickCreate(p, "Trivia night at Rosie's", ["27", "28"]),
    );
    await record(browser, 9, "guest-return", "light", (page) =>
      driveGuestReturn(page, triviaSlug),
    );

    // Phase 12 — guest home, always-on share, and the signed-in your/joined tabs.

    // A second host (Taylor) creates a poll that the owner (Alex) then joins, so
    // Alex's "Joined" tab has a real row. Requires ALLOWLIST_ENABLED=false so a
    // non-owner can create during the capture run.
    const taylorSlug = await plain(browser, (p) =>
      quickCreateAs(
        p,
        "taylor@example.com",
        "Taylor",
        "Taylor's game night 🎮",
        ["20", "21"],
      ),
    );
    await plain(browser, (p) =>
      voteAsUser(p, OWNER, "Alex", taylorSlug, ["Yes", "If-need-be"]),
    );

    // Guest "looked at" home: one browser (no dev-login) opens two polls — which
    // records them in localStorage — then lands on / to find them listed, with
    // the persistent "sign in to keep your polls" nudge.
    await record(browser, 12, "guest-home", "light", async (page) => {
      await page.goto(`${BASE}/p/${bookSlug}`, { waitUntil: "networkidle" });
      await wait(page, 1000);
      await page.goto(`${BASE}/p/${triviaSlug}`, { waitUntil: "networkidle" });
      await wait(page, 1000);
      await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
      await page.waitForSelector("text=Polls you've seen");
      await wait(page, 1700);
      await page.mouse.wheel(0, 160);
      await wait(page, 1300);
    });

    // Always-on share button: the app-bar icon shares/copies the poll link. In
    // a headless context (no Web Share API) it falls back to the Clipboard API
    // and confirms with a "Link copied" toast — available to guests, on every
    // poll screen.
    await record(browser, 12, "share-button", "light", async (page) => {
      await page.goto(`${BASE}/p/${bookSlug}`, { waitUntil: "networkidle" });
      await wait(page, 1000);
      await page.getByRole("button", { name: "Share or copy link" }).click();
      await page.waitForSelector("text=Link copied");
      await wait(page, 1700);
    });

    // Guest → account claim: a guest votes, then signs in, and the guest ballot
    // is tied to the account (stays marked, bar reads "Update"). Its own poll so
    // it doesn't disturb the lists/tallies recorded above.
    const studySlug = await plain(browser, (p) =>
      quickCreate(p, "Dana's study group 📚", ["8", "9", "10"]),
    );
    await record(browser, 12, "guest-claim", "light", (page) =>
      driveGuestClaim(page, studySlug),
    );

    // Signed-in home: the "Your polls" / "Joined" segmented tabs. Alex sees the
    // polls they created, switches to the poll they joined (Taylor's), and back.
    await record(browser, 12, "home-tabs", "light", async (page) => {
      await devLogin(page, "/");
      await page.waitForSelector("text=Your polls");
      await wait(page, 1300);
      await page.getByRole("button", { name: /^Joined/ }).click();
      await wait(page, 1700);
      await page.getByRole("button", { name: /^Your polls/ }).click();
      await wait(page, 1200);
    });

    // Profile pictures (this change): signed-in voters carry their Google photo
    // into the identity row and the results avatar stacks. Its own poll, seeded
    // with two photo-carrying voters, so the lists/tallies above are untouched.
    const dinnerSlug = await plain(browser, (p) =>
      quickCreate(p, "Friends dinner 🍝", ["14", "15", "16"]),
    );
    await plain(browser, (p) =>
      voteAsUser(
        p,
        "priya@example.com",
        "Priya",
        dinnerSlug,
        ["Yes", "If-need-be", "Yes"],
        AVATAR(9),
      ),
    );
    await plain(browser, (p) =>
      voteAsUser(
        p,
        "marcus@example.com",
        "Marcus",
        dinnerSlug,
        ["Yes", "Yes", "No"],
        AVATAR(12),
      ),
    );
    await record(browser, 12, "profile-avatars", "light", (page) =>
      driveProfileAvatars(page, dinnerSlug),
    );
  } finally {
    await browser.close();
    rmSync(TMP_DIR, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
