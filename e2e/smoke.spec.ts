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
  expect(download.suggestedFilename()).toBe("BOM.pdf");

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
