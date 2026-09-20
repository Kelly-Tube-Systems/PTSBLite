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

/** Answer the welcome screen's setup form with its defaults. */
async function createDesign(page: Page): Promise<void> {
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
  await expect(page.getByText("Welcome to PTSBLite")).toBeVisible();
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
  // Exercises the WebGL view capture, pdf-lib, and the object-URL download.
  await page.getByRole("button", { name: "Download PDF" }).click();
  const download = await downloadPromise;
  // The document's own title, dated the day it was taken, with the date's
  // slashes turned into something a file name can hold.
  expect(download.suggestedFilename()).toMatch(/^Kelly Systems PTSBLite BOM \d\d-\d\d-\d\d\.pdf$/);

  expect(errors).toEqual([]);
});

test("moves the quick start guide out from under an open tool drawer", async ({ page }) => {
  // Another one only a real browser can see: happy-dom has no layout, so no
  // unit test can tell that two absolutely positioned panels land on the same
  // corner. The client picked a tool and found the Quick Start Guide painted
  // across the drawer it opened (Trello YzEkigr8).
  await createDesign(page);

  const guide = page.locator(".quickstart");
  // Both drawers are always in the DOM; only the open one carries the class.
  const drawer = page.locator(".left-rail__drawer--open");
  const home = await guide.boundingBox();
  expect(home).not.toBeNull();

  await page.getByRole("button", { name: "Build", exact: true }).click();
  await expect(drawer).toHaveCount(1);

  // The two overlap vertically whatever happens — both run to the bottom of
  // the window — so a positive horizontal gap is the whole of "neither covers
  // the other". Polled because the guide slides rather than jumps.
  await expect
    .poll(async () => {
      const g = await guide.boundingBox();
      const d = await drawer.boundingBox();
      return g && d ? g.x - (d.x + d.width) : -Infinity;
    })
    .toBeGreaterThan(0);

  // And back to the corner the client asked for once the drawer is gone.
  await page.keyboard.press("Escape");
  await expect.poll(async () => (await guide.boundingBox())?.x).toBeCloseTo(home!.x, 0);
});

test("keeps the tool pill clear of both bottom corner panels", async ({ page }) => {
  // The same class of bug as the one above and the same reason it needs a real
  // browser: the pill is centred along the bottom and the quick start guide and
  // controls legend hold the two corners it runs into. The client reported it
  // twice (Trello U5EBg7gR) because the first fix was measured on one window
  // and his was narrower, so the width is the test.
  //
  // 1200px is the app's own minimum (`#root` in app.css), which is where the
  // two boxes leave the pill least room. Anything wider only helps.
  await page.setViewportSize({ width: 1200, height: 800 });
  await createDesign(page);
  await page.getByRole("button", { name: "Build", exact: true }).click();
  await page.getByRole("button", { name: "Blower Unit", exact: true }).click();

  const gaps = async () => {
    const [pill, guide, legend] = await Promise.all(
      [".active-tool-bar", ".quickstart", ".legend"].map((sel) => page.locator(sel).boundingBox())
    );
    if (!pill || !guide || !legend) return null;
    // All three sit on the bottom of the window and overlap vertically, so a
    // positive horizontal gap on each side is the whole of "nothing covers the
    // pill" — the same reasoning as the drawer test above.
    return Math.min(pill.x - (guide.x + guide.width), legend.x - (pill.x + pill.width));
  };

  expect(await gaps()).toBeGreaterThan(0);

  // And with the Build drawer open, which slides the guide further across the
  // bottom and leaves the pill less room still.
  await page.getByRole("button", { name: "Build", exact: true }).click();
  await expect.poll(gaps).toBeGreaterThan(0);
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
