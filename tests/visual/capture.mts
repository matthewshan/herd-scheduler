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
import { chromium, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.CAPTURE_BASE_URL ?? "http://localhost:3000";
const OWNER = process.env.OWNER_EMAIL ?? "matthewshan99@gmail.com";
// Output GIFs are grouped by phase: docs/screenshots/phase-<n>/.
const outDir = (phase: number) => `docs/screenshots/phase-${phase}`;
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
  execFileSync("ffmpeg", ["-y", "-i", webmPath, "-vf", filters, gifPath], {
    stdio: "ignore",
  });
}

interface Recorded<T> {
  result: T;
}

/** Run one scenario in its own recorded context, then emit the GIF. */
async function record<T>(
  browser: import("@playwright/test").Browser,
  phase: number,
  name: string,
  colorScheme: "light" | "dark",
  fn: (page: Page) => Promise<T>,
): Promise<Recorded<T>> {
  const videoDir = join(TMP_DIR, name);
  const context = await browser.newContext({
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
  console.log(`✓ phase-${phase}/${name}.gif`);
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

/** Cast a guest ballot on a poll (data-seeding; no recording, minimal waits). */
async function voteAs(
  page: Page,
  slug: string,
  name: string,
  picks: string[],
): Promise<void> {
  await page.goto(`${BASE}/p/${slug}`, { waitUntil: "networkidle" });
  await page.waitForSelector("text=Which times work for you?");
  await page.getByLabel("Your name").fill(name);
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

/** Quickly create a poll as the owner (data-seeding). Returns the slug. */
async function quickCreate(
  page: Page,
  title: string,
  days: string[],
): Promise<string> {
  await devLogin(page, "/create");
  await page.waitForSelector("#poll-title");
  await page.locator("#poll-title").fill(title);
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
  await page.getByRole("button", { name: "Finalize this time" }).first().click();
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
  await page.getByRole("button", { name: /Copy link/ }).first().click();
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

async function main(): Promise<void> {
  rmSync(TMP_DIR, { recursive: true, force: true });
  mkdirSync(TMP_DIR, { recursive: true });

  const browser = await chromium.launch();
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
  } finally {
    await browser.close();
    rmSync(TMP_DIR, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
