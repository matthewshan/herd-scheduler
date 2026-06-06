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
 */
import { chromium, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.CAPTURE_BASE_URL ?? "http://localhost:3000";
const OWNER = process.env.OWNER_EMAIL ?? "matthewshan99@gmail.com";
const OUT_DIR = "docs/screenshots/phase-5";
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
  name: string,
  colorScheme: "light" | "dark",
  fn: (page: Page) => Promise<T>,
): Promise<Recorded<T>> {
  const videoDir = join(TMP_DIR, name);
  const context = await browser.newContext({
    viewport: VIEWPORT,
    colorScheme,
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
  webmToGif(join(videoDir, webm), join(OUT_DIR, `${name}.gif`));
  console.log(`✓ ${name}.gif`);
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

async function main(): Promise<void> {
  rmSync(TMP_DIR, { recursive: true, force: true });
  mkdirSync(OUT_DIR, { recursive: true });
  mkdirSync(TMP_DIR, { recursive: true });

  const browser = await chromium.launch();
  try {
    const { result: slug } = await record(
      browser,
      "create-flow",
      "light",
      driveCreate,
    );

    await record(browser, "poll-page", "light", (page) =>
      driverPollPage(page, slug),
    );

    // A short dark-mode pass over the create form, for the theme coverage.
    await record(browser, "create-dark", "dark", async (page) => {
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
  } finally {
    await browser.close();
    rmSync(TMP_DIR, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
