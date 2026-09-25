import { expect, test, type Page } from "@playwright/test";

/**
 * The real-browser smoke suite: the few behaviours CI could not otherwise see.
 * happy-dom has no WebGL, no downloads, and no meaningful storage, so the unit
 * suites prove the logic while this proves the assembled production build
 * actually boots, renders, places through the raycaster, autosaves, and
 * exports. Anything more belongs in a domain or component test, not here.
 *
 * Deliberately no screenshot or pixel assertions: these tests prove the app
 * *runs*, not that it looks right — a shader change rendering everything
 * magenta still passes. Visual regression testing was considered and rejected
 * as too flaky for a project this size; looking right stays a human check
 * (see CLAUDE.md's note on checking the production build by hand).
 */

/** Uncaught page errors collected from `page`; asserted empty at the end. */
function collectPageErrors(page: Page): Error[] {
  const errors: Error[] = [];
  page.on("pageerror", (error) => errors.push(error));
  return errors;
}

/**
 * Mark the first-visit contact form as already submitted, for tests about what
 * comes after it. Runs before every navigation, reloads included.
 */
async function skipContactForm(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.setItem("ptsblite:contact:v1", "2026-09-25T00:00:00.000Z");
  });
}

/** Answer the welcome screen's setup form with its defaults. */
async function createDesign(page: Page): Promise<void> {
  await skipContactForm(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Create design" }).click();
}

/** The status bar's PARTS readout, which counts the placed parts. */
function partsCount(page: Page) {
  return page.locator(".status-bar__meta", { hasText: "PARTS" }).locator(".status-bar__meta-value");
}

/** Arm the blower tool and click the viewport's centre to place one. */
async function placeBlower(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Build", exact: true }).click();
  await page.getByRole("button", { name: "Blower Unit", exact: true }).click();
  // The click raycasts against the real scene: it only places a part if the
  // WebGL canvas, the camera, and the picking maths all actually work.
  await page.locator(".viewport-canvas canvas").click();
  await expect(partsCount(page)).toHaveText("1");
}

test("boots, renders the viewport, and places a part", async ({ page }) => {
  const errors = collectPageErrors(page);

  await page.goto("/");
  // A first visit fills in the contact form before anything else.
  await page.getByLabel("First name").fill("Ada");
  await page.getByLabel("Last name").fill("Lovelace");
  await page.getByLabel("Company name").fill("Analytical Engines");
  await page.getByLabel("Phone number").fill("555-0100");
  await page.getByLabel("Email").fill("ada@example.com");
  await page.getByLabel("Industry").selectOption("Retail");
  // `pnpm preview` answers for the Pages Function, so this proves the page
  // posts the details to it and the CSP lets it.
  const posted = page.waitForRequest("**/api/contact");
  await page.getByRole("button", { name: "Continue" }).click();
  expect((await posted).postDataJSON()).toMatchObject({ email: "ada@example.com" });
  await page.getByRole("button", { name: "Create design" }).click();

  await expect(page.locator(".viewport-canvas canvas")).toBeVisible();
  await expect(partsCount(page)).toHaveText("0");
  await placeBlower(page);

  expect(errors).toEqual([]);
});

test("autosaves to real storage and restores after a reload", async ({ page }) => {
  await createDesign(page);
  await placeBlower(page);

  // Reload immediately: the pagehide flush, not the debounce, must cover this.
  await page.reload();
  await expect(page.getByText("Welcome back")).toBeVisible();
  await page.getByRole("button", { name: "Continue design" }).click();
  await expect(partsCount(page)).toHaveText("1");
});

test("exports the BOM PDF through the real download path", async ({ page }) => {
  const errors = collectPageErrors(page);

  await createDesign(page);
  await placeBlower(page);

  await page.getByRole("button", { name: "Finalize" }).click();

  // The dialog's body must actually be on screen. It once opened as a 33px
  // strip — heading clipped, parts table scrolled out of sight — because its
  // scroll region took a zero flex base size (Trello #84). Asserting the first
  // part row sits inside the region's visible box is the cheapest statement of
  // "the body is not blank"; it holds however long the BOM gets.
  const body = await page.locator(".finalize__scroll").boundingBox();
  const firstRow = await page.locator(".bom__table tbody tr").first().boundingBox();
  expect(body).not.toBeNull();
  expect(firstRow).not.toBeNull();
  expect(firstRow!.y + firstRow!.height).toBeLessThanOrEqual(body!.y + body!.height);

  const downloadPromise = page.waitForEvent("download");
  // `pnpm preview` answers for the Pages Function, so this proves the same PDF
  // is posted to it for sales and the CSP lets it.
  const emailed = page.waitForRequest("**/api/bom");
  // Exercises the WebGL view capture, pdf-lib, and the object-URL download.
  await page.getByRole("button", { name: "Download PDF" }).click();
  const download = await downloadPromise;
  // The document's own title, dated the day it was taken, with the date's
  // slashes turned into something a file name can hold.
  expect(download.suggestedFilename()).toMatch(/^Kelly Systems PTSBLite BOM \d\d-\d\d-\d\d\.pdf$/);
  const posted = (await emailed).postDataJSON() as { pdf: string; filename: string };
  expect(posted.filename).toBe(download.suggestedFilename());
  expect(Buffer.from(posted.pdf, "base64").subarray(0, 5).toString()).toBe("%PDF-");

  expect(errors).toEqual([]);
});

test("moves the bottom-left panel out from under an open tool drawer", async ({ page }) => {
  // Another one only a real browser can see: happy-dom has no layout, so no
  // unit test can tell that two absolutely positioned panels land on the same
  // corner. The client picked a tool and found the panel in that corner painted
  // across the drawer it opened (Trello YzEkigr8).
  //
  // The panel is the controls legend since the client swapped the two corner
  // boxes (Trello sOmRvSTZ). Stepping aside belongs to the corner rather than
  // to either box, so this watches whichever one holds it.
  await createDesign(page);

  const corner = page.locator(".legend");
  // Both drawers are always in the DOM; only the open one carries the class.
  const drawer = page.locator(".left-rail__drawer--open");
  const home = await corner.boundingBox();
  expect(home).not.toBeNull();

  await page.getByRole("button", { name: "Build", exact: true }).click();
  await expect(drawer).toHaveCount(1);

  // The two overlap vertically whatever happens — both run to the bottom of
  // the window — so a positive horizontal gap is the whole of "neither covers
  // the other". Polled because the panel slides rather than jumps.
  await expect
    .poll(async () => {
      const c = await corner.boundingBox();
      const d = await drawer.boundingBox();
      return c && d ? c.x - (d.x + d.width) : -Infinity;
    })
    .toBeGreaterThan(0);

  // And back to the corner the client asked for once the drawer is gone.
  await page.keyboard.press("Escape");
  await expect.poll(async () => (await corner.boundingBox())?.x).toBeCloseTo(home!.x, 0);
});

test("reads the active tool out in the footer rail, clear of the rail's own contents", async ({
  page
}) => {
  // The tool readout used to float along the bottom of the viewport, where the
  // quick start guide and the controls legend covered its ends. The client
  // reported that twice (Trello U5EBg7gR) and then asked for the floating box
  // to go into the rail instead (ADR-0048, Trello M5RYJLHW).
  //
  // Nothing in the viewport can reach the rail, so what is left to prove is
  // that the readout fits between the design's own numbers and Finalize. That
  // is a text-measurement question no unit suite can answer: happy-dom lays
  // nothing out. 1200px is the app's own minimum (`#root` in app.css), where
  // the rail is tightest; anything wider only helps.
  await page.setViewportSize({ width: 1200, height: 800 });
  await createDesign(page);
  await page.getByRole("button", { name: "Build", exact: true }).click();
  // The bend's name and number make the longest label any tool has, so it is
  // the one that has to fit.
  await page.getByRole("button", { name: "90° Bend (3ft radius)" }).click();

  // The floating box is gone rather than moved.
  await expect(page.locator(".active-tool-bar")).toHaveCount(0);

  const gaps = async () => {
    const [tool, parts, finalize] = await Promise.all([
      page.locator('.status-bar__meta[data-meta="tool"]').boundingBox(),
      page.locator(".status-bar__meta", { hasText: "PARTS" }).boundingBox(),
      page.locator(".status-bar__finalize").boundingBox()
    ]);
    if (!tool || !parts || !finalize) return null;
    // Everything in the rail sits on one 54px row and overlaps vertically, so a
    // positive horizontal gap on each side is the whole of "the readout fits" —
    // the same reasoning as the drawer test above.
    return Math.min(tool.x - (parts.x + parts.width), finalize.x - (tool.x + tool.width));
  };

  expect(await gaps()).toBeGreaterThan(0);

  // And with a height on the readout too, which is the longest it ever gets.
  await page.keyboard.press("]");
  await expect(page.locator('[data-meta="elevation"]')).toBeVisible();
  await expect.poll(gaps).toBeGreaterThan(0);

  // The panels that used to cover it cannot reach the rail at all: the viewport
  // they are positioned in ends where the rail begins.
  const [guide, rail] = await Promise.all([
    page.locator(".quickstart").boundingBox(),
    page.locator(".status-bar").boundingBox()
  ]);
  expect(guide!.y + guide!.height).toBeLessThanOrEqual(rail!.y);
});

test("draws an obstacle box by dragging one corner to the other", async ({ page }) => {
  // The press, the drag and the release only meet in a real browser: happy-dom
  // has no raycaster, and the unit suites can prove the phase and the gesture
  // maths but not that a held button draws a box instead of moving the camera
  // (Trello EcZrRueR).
  const errors = collectPageErrors(page);
  await createDesign(page);

  const canvas = page.locator(".viewport-canvas canvas");
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  await page.keyboard.press("o");

  const from = { x: box!.x + box!.width / 2 - 60, y: box!.y + box!.height / 2 };
  const to = { x: from.x + 120, y: from.y + 40 };
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  // More than one step, so the pointer really travels: a jump from press to
  // release would pass even if a drag still moved the camera.
  await page.mouse.move(to.x, to.y, { steps: 12 });
  await page.mouse.up();

  // The height stepper and Place only exist once a footprint is closed, which
  // is the whole of "the drag drew the box".
  const place = page.getByRole("button", { name: "Place", exact: true });
  await expect(place).toBeVisible();
  await place.click();
  await page.getByRole("button", { name: "Erase", exact: true }).click();
  await expect(page.getByRole("button", { name: /Clear all obstacles/ })).toContainText("1 placed");

  expect(errors).toEqual([]);
});

test("lets a short window scroll down to the rest of the setup form", async ({ page }) => {
  // happy-dom has no layout, so this can only be caught in a real browser. The
  // client opened the app in a window too short for the whole setup form and
  // got it cut off at the bottom edge with "Create design" below the cut and
  // no way to scroll to it, which left the app unstartable (Trello ui0X38fE).
  const height = 320;
  await page.setViewportSize({ width: 1000, height });
  await skipContactForm(page);
  await page.goto("/");

  const button = page.getByRole("button", { name: "Create design" });
  const cutOff = await button.boundingBox();
  expect(cutOff).not.toBeNull();
  // The window really is short enough to cut the form: the assertion below
  // would hold trivially in a window the form fits in.
  expect(cutOff!.y + cutOff!.height).toBeGreaterThan(height);

  // Scrolled with the wheel rather than `scrollIntoViewIfNeeded`, because that
  // is the difference the fix makes: an `overflow: hidden` dialog still scrolls
  // when a script asks it to, and never when the person at the window does.
  await page.locator("dialog.modal-dialog").hover();
  await page.mouse.wheel(0, 400);
  await expect
    .poll(async () => {
      const box = await button.boundingBox();
      return box ? box.y + box.height : Infinity;
    })
    .toBeLessThanOrEqual(height);

  await button.click();
  await expect(page.locator(".viewport-canvas canvas")).toBeVisible();
});
