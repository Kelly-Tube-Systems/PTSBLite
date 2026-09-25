import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  _electron as electron,
  expect,
  test,
  type ElectronApplication,
  type Page
} from "@playwright/test";

/**
 * The packaged Windows app, before CI releases it to every installed copy.
 * e2e/ proves the page works; this proves what only the desktop host can
 * break. The page loads from its own origin under its own policy, opens with
 * no contact form, keeps its design across a restart, saves a BOM, and asks
 * the network for nothing (ADR-0051, ADR-0056).
 */

const EXECUTABLE = resolve(
  import.meta.dirname,
  "../dist-desktop/release/win-unpacked/PTSBLite.exe"
);

type Launched = {
  app: ElectronApplication;
  page: Page;
  /** Uncaught errors and console errors, which is where a CSP refusal lands. */
  errors: string[];
  /** Every URL the page asked for. */
  requests: string[];
};

/** An empty folder in this test's own output, which Playwright clears on every run. */
function scratchFolder(name: string): string {
  const folder = test.info().outputPath(name);
  mkdirSync(folder, { recursive: true });
  return folder;
}

/** A profile of its own, so a run never touches the design in a real installed copy. */
function freshProfile(): string {
  return scratchFolder("profile");
}

async function launch(profile: string): Promise<Launched> {
  const app = await electron.launch({
    executablePath: EXECUTABLE,
    args: [`--user-data-dir=${profile}`],
    env: { ...process.env, PTSBLITE_NO_UPDATES: "1" }
  });
  const errors: string[] = [];
  const requests: string[] = [];
  app.context().on("request", (request) => requests.push(request.url()));
  const page = await app.firstWindow();
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  return { app, page, errors, requests };
}

/** The status bar's PARTS readout, which counts the placed parts. */
function partsCount(page: Page) {
  return page.locator(".status-bar__meta", { hasText: "PARTS" }).locator(".status-bar__meta-value");
}

/** Arm the blower tool and click the viewport's centre to place one. */
async function placeBlower(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Build", exact: true }).click();
  await page.getByRole("button", { name: "Blower Unit", exact: true }).click();
  // Only places a part if WebGL, the camera and the picking maths all work.
  await page.locator(".viewport-canvas canvas").click();
  await expect(partsCount(page)).toHaveText("1");
}

test("opens on the welcome screen, from the origin its autosave lives in", async () => {
  const { app, page, errors } = await launch(freshProfile());

  await expect(page.getByRole("button", { name: "Create design" })).toBeVisible();
  // The website asks for contact details first; the Windows app never does.
  await expect(page.getByLabel("First name")).toHaveCount(0);
  // Autosave is scoped to this origin. A release that moved it would strand
  // the design in every installed copy it updated (ADR-0012).
  expect(page.url()).toBe("app://ptsblite/");

  expect(errors).toEqual([]);
  await app.close();
});

test("keeps the design across a restart", async () => {
  const profile = freshProfile();
  const first = await launch(profile);
  await first.page.getByRole("button", { name: "Create design" }).click();
  await placeBlower(first.page);
  // Closed at once: the pagehide flush, not the debounce, must cover this. It
  // is what an update's restart does.
  await first.app.close();

  const second = await launch(profile);
  await expect(second.page.getByText("Welcome back")).toBeVisible();
  await second.page.getByRole("button", { name: "Continue design" }).click();
  await expect(partsCount(second.page)).toHaveText("1");
  await second.app.close();
});

test("saves the BOM PDF and sends nothing", async () => {
  const { app, page, errors, requests } = await launch(freshProfile());
  const downloads = scratchFolder("downloads");
  // In place of the save dialog a person would answer.
  await app.evaluate(({ session }, folder) => {
    session.defaultSession.on("will-download", (_event, item) => {
      item.setSavePath(`${folder}\\${item.getFilename()}`);
    });
  }, downloads);

  await page.getByRole("button", { name: "Create design" }).click();
  await placeBlower(page);
  await page.getByRole("button", { name: "Finalize" }).click();
  await page.getByRole("button", { name: "Download PDF" }).click();

  await expect.poll(() => readdirSync(downloads)).toHaveLength(1);
  const [name] = readdirSync(downloads);
  expect(name).toMatch(/^Kelly Systems PTSBLite BOM \d\d-\d\d-\d\d\.pdf$/);
  const file = join(downloads, name);
  await expect
    .poll(() => existsSync(file) && readFileSync(file).subarray(0, 5).toString())
    .toBe("%PDF-");

  // Everything the page loaded came from inside the app: no contact post, no
  // BOM email, nothing from the internet.
  expect(requests.length).toBeGreaterThan(0);
  expect(
    requests.filter((url) => !/^(app:\/\/ptsblite\/|data:|blob:app:\/\/ptsblite\/)/.test(url))
  ).toEqual([]);
  expect(errors).toEqual([]);
  await app.close();
});
