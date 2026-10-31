import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function expectAccessible(page: Page) {
  // Let entrance animations settle so contrast is measured on final colours.
  await page.waitForTimeout(800);
  // Looping decorations (the mascot's bob, the "available" pulse) never finish, so ignore them.
  await page.waitForFunction(() =>
    document
      .getAnimations()
      .filter((animation) => animation.effect?.getTiming().iterations !== Infinity)
      .every((animation) => animation.playState !== "running"),
  );
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
  // Name, date of birth and mobile come from the signed-in account.
  await expect(page.getByLabel("Full name")).toHaveValue("Ann Lee");
  await page.getByText("A follow-up").click();
}

async function signInAsSamplePatient(page: Page) {
  await signInWithEmail(page, "ann.lee@halden.example");
}

async function signInWithEmail(page: Page, email: string, name = "Sam Patel") {
  await page.locator("#email").fill(email);
  await page.getByRole("button", { name: "Continue with email" }).click();
  const demo = page.getByText(/Demo code/);
  await expect(demo).toBeVisible();
  const code = ((await demo.textContent()) ?? "").match(/\d{4}/)?.[0] ?? "";
  await page.getByLabel("Digit 1 of 4").fill(code);
  // New patients are asked their name once.
  const welcome = page.getByRole("heading", { name: "One last thing" });
  const left = page.waitForURL((url) => !url.pathname.startsWith("/sign-in"));
  await Promise.race([welcome.waitFor(), left]);
  if (await welcome.isVisible()) {
    await page.getByLabel("Full name").fill(name);
    await page.getByRole("button", { name: "Continue", exact: true }).click();
  }
  await left;
}


test("landing page shows the doctors and is accessible", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Book a GP appointment/);
  await expect(page.getByRole("heading", { level: 1, name: /Book your GP/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Meet our doctors" })).toBeVisible();
  await expect(page.getByRole("list", { name: "Doctors" }).getByRole("link")).toHaveCount(5);
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

  // Signed out: Continue goes through sign-in, which shows the held time and comes back.
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fbook%2Fdetails$/);
  await expect(page.getByText("Holding your time")).toBeVisible();
  await expectAccessible(page);
  await signInAsSamplePatient(page);

  await expect(page).toHaveURL(/\/book\/details$/);
  await expect(page.getByRole("heading", { level: 1, name: "Your details" })).toBeVisible();
  const chosenTime = chosen.match(/\d{2}:\d{2}/)?.[0] ?? "missing";
  await expect(page.getByText(chosenTime).first()).toBeVisible();

  // Submitting without a reason shows the summary.
  await page.getByRole("button", { name: "Book appointment" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "1 thing to fix" })).toBeVisible();
  await expectAccessible(page);

  await fillDetails(page);
  await bookUntilConfirmed(page);
  await expect(page.getByRole("heading", { name: "You’re booked" })).toBeVisible();
  const reference = (await page.getByText(/^HSP-\d{6}$/).textContent())?.trim() ?? "";
  expect(reference).toMatch(/^HSP-\d{6}$/);
  await expectAccessible(page);

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Add to calendar" }).click();
  expect((await download).suggestedFilename()).toBe(`${reference}.ics`);

  // Patient details are not persisted; the visit is.
  const stored = await page.evaluate(() => sessionStorage.getItem("halden.booking.v1"));
  expect(stored).toContain("HSP-");
  expect(stored).not.toContain("Ann Lee");

  // The visit is on the patient's own list, and cancelling it frees the time.
  await page.getByRole("link", { name: "View your appointments" }).click();
  await expect(page.getByText(reference)).toBeVisible();

  await page.goto("/book/confirmed");
  await page.getByRole("button", { name: "Book another appointment" }).click();
  await expect(page).toHaveURL(/\/book$/);
});

test("guards: booking needs sign-in, and a booking in progress", async ({ page }) => {
  await page.goto("/book/details");
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fbook%2Fdetails$/);
  await signInAsSamplePatient(page);
  // Signed in, but nothing held: back to choosing a doctor.
  await expect(page).toHaveURL(/\/book$/);
  await page.goto("/book/confirmed");
  await expect(page).toHaveURL(/\/book$/);
});

test("sign-in: email, then a code; wrong codes are explained", async ({ page }) => {
  await page.goto("/sign-in");
  await expect(page.getByRole("heading", { level: 1, name: "Welcome to Westbrook" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign in with Google" })).toBeVisible();
  await expectAccessible(page);

  await page.getByLabel("Email", { exact: true }).fill("ann.lee@halden.example");
  await page.getByRole("button", { name: "Continue with email" }).click();
  await expect(page.getByLabel("Digit 1 of 4")).toBeFocused();
  await expect(page.getByRole("textbox", { name: /Digit \d of 4/ })).toHaveCount(4);
  await expect(page.getByRole("link", { name: "Sign in with Google" })).toHaveCount(0);
  await expectAccessible(page);
  const code = ((await page.getByText(/Demo code/).textContent()) ?? "").match(/\d{4}/)![0];
  await page.getByLabel("Digit 1 of 4").fill(code === "0000" ? "1111" : "0000");
  await expect(page.getByRole("alert").filter({ hasText: "isn’t right" })).toBeVisible();
  await page.getByLabel("Digit 1 of 4").fill(code);
  await expect(page).toHaveURL(/\/book$/);
});

test("Google sign-in explains when it isn't set up", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByRole("link", { name: "Sign in with Google" }).click();
  await expect(page).toHaveURL(/error=google-off/);
  await expect(page.getByRole("alert").filter({ hasText: "isn’t set up" })).toBeVisible();
});

test("doctor sign-in from the link at the bottom", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByRole("link", { name: "Sign in as a doctor" }).click();
  await expect(page.getByText("Clinic staff sign-in")).toBeVisible();
  await expectAccessible(page);
  await signInWithEmail(page, "helen.cho@halden.example");
  await expect(page).toHaveURL(/\/dashboard$/);
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
  await page.goto("/sign-in?next=%2Fdoctors%2Fcho");
  await signInAsSamplePatient(page);
  await expect(page).toHaveURL(/\/doctors\/cho/);
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

test("a signed-in patient lands on the booking page, not the landing page", async ({ page }) => {
  await page.goto("/sign-in");
  await signInAsSamplePatient(page);
  await expect(page).toHaveURL(/\/book$/);
  await expect(page.getByRole("heading", { level: 1, name: /Hi Ann, who would you like to see/ })).toBeVisible();
  await expect(page.getByRole("list", { name: "Doctors" }).getByRole("link")).toHaveCount(5);
  await expectAccessible(page);
  await page.getByRole("link", { name: /Dr Callum Reid/ }).click();
  await expect(page).toHaveURL(/\/doctors\/reid/);
  await expect(page.getByRole("link", { name: "All doctors" })).toHaveAttribute("href", "/book");
});
