import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function expectAccessible(page: Page) {
  // Let entrance animations settle so contrast is measured on final colours.
  await page.waitForTimeout(800);
  await page.waitForFunction(() => document.getAnimations().every((animation) => animation.playState !== "running"));
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  const serious = results.violations.filter((item) => item.impact === "serious" || item.impact === "critical");
  expect(serious, JSON.stringify(serious.map((item) => [item.id, item.nodes.map((node) => node.target)]), null, 2)).toEqual([]);
}

async function chooseFirstOpenTime(page: Page) {
  // The visible week may be full; step forward until something is open.
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const open = page.locator('input[name="slot"]:not([disabled])');
    if ((await open.count()) > 0) {
      await open.first().locator("..").click();
      return;
    }
    await page.getByRole("button", { name: "Next week" }).click();
  }
  throw new Error("No open time in the window");
}

async function bookUntilConfirmed(page: Page) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    await page.getByRole("button", { name: "Book appointment" }).click();
    await page.waitForURL(/\/(book\/confirmed|doctors\/)/);
    if (/\/book\/confirmed$/.test(page.url())) return;
    await chooseFirstOpenTime(page);
    await page.getByRole("button", { name: "Continue" }).click();
    await fillDetails(page);
  }
  throw new Error("Could not book an open time");
}

async function fillDetails(page: Page) {
  await page.getByLabel("Full name").fill("Ann Lee");
  await page.getByLabel("Date of birth").fill("1980-03-14");
  await page.getByLabel("Mobile number").fill("07700 900123");
  await page.getByText("A follow-up").click();
}

test("directory is accessible and filters", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Book a GP appointment/);
  await expectAccessible(page);
  await page.getByRole("radio", { name: "Diabetes" }).click();
  await expect(page.getByText("1 doctor in diabetes")).toBeVisible();
  await expect(page.getByRole("link", { name: /Dr Callum Reid/ })).toBeVisible();
});

test("full booking flow, with refresh and back", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: /Dr Helen Cho/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Dr Helen Cho" })).toBeFocused();
  await expect(page).toHaveURL(/\/doctors\/cho\?week=\d{4}-\d{2}-\d{2}/);
  await expectAccessible(page);

  await chooseFirstOpenTime(page);
  const chosen = await page.getByText("Your time").locator("..").innerText();

  // Refresh keeps the chosen time.
  await page.reload();
  await expect(page.getByRole("button", { name: "Continue" })).toBeVisible();

  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/book\/details$/);
  await expect(page.getByRole("heading", { level: 1, name: "Your details" })).toBeFocused();
  await expect(page.getByText(chosen.split("\n").pop()!.split(", ")[1]!).first()).toBeVisible();

  // Submitting empty shows the summary.
  await page.getByRole("button", { name: "Book appointment" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "things to fix" })).toBeVisible();
  await expect(page.getByLabel("Full name")).toBeFocused();
  await expectAccessible(page);

  await fillDetails(page);
  await bookUntilConfirmed(page);
  await expect(page.getByRole("heading", { name: "You’re booked" })).toBeVisible();
  await expect(page.getByText(/^HSP-\d{4}$/)).toBeVisible();
  await expectAccessible(page);

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Add to calendar" }).click();
  expect((await download).suggestedFilename()).toMatch(/^HSP-\d{4}\.ics$/);

  // Patient details are not persisted; the visit is.
  const stored = await page.evaluate(() => sessionStorage.getItem("halden.booking.v1"));
  expect(stored).toContain("HSP-");
  expect(stored).not.toContain("Ann Lee");

  await page.getByRole("button", { name: "Book another appointment" }).click();
  await expect(page).toHaveURL(/\/$/);
});

test("guards: details and confirmation need a booking in progress", async ({ page }) => {
  await page.goto("/book/details");
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/book/confirmed");
  await expect(page).toHaveURL(/\/$/);
});

test("unknown doctor shows a helpful 404", async ({ page }) => {
  const response = await page.goto("/doctors/nobody");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "We can’t find that page" })).toBeVisible();
  await expectAccessible(page);
});

test("deep link to a week is clamped into the bookable window", async ({ page }) => {
  await page.goto("/doctors/adeyemi?week=1999-01-01");
  await expect(page.getByRole("button", { name: "Previous week" })).toBeDisabled();
});

test("keyboard-only booking", async ({ page, isMobile }) => {
  test.skip(isMobile, "Keyboard path is checked on desktop");
  await page.goto("/doctors/cho");
  await page.keyboard.press("Tab"); // skip link
  await expect(page.getByRole("link", { name: "Skip to main content" })).toBeFocused();
  await page.locator('input[name="slot"]:not([disabled])').first().focus();
  await page.keyboard.press("Space");
  await page.getByRole("button", { name: "Continue" }).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/book\/details$/);
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/\/doctors\/cho/);
});

test("sends security headers", async ({ request }) => {
  const response = await request.get("/");
  const headers = response.headers();
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(headers["content-security-policy"]).toMatch(/script-src 'self' 'nonce-/);
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["x-powered-by"]).toBeUndefined();
});
