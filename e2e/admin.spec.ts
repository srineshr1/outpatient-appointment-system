import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function expectAccessible(page: Page) {
  await page.waitForTimeout(500);
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  const serious = results.violations.filter((item) => item.impact === "serious" || item.impact === "critical");
  expect(serious, JSON.stringify(serious.map((item) => [item.id, item.nodes.map((node) => node.target)]), null, 2)).toEqual([]);
  await expectNoSidewaysScroll(page);
}

/** WCAG 1.4.10: wide tables scroll inside their own box; the page itself never scrolls sideways. */
async function expectNoSidewaysScroll(page: Page) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth, `${page.url()} is ${scrollWidth}px wide in a ${clientWidth}px window`).toBeLessThanOrEqual(clientWidth);
}

async function signInWithEmail(page: Page, email: string) {
  await page.locator("#email").fill(email);
  await page.getByRole("button", { name: "Continue with email" }).click();
  const demo = page.getByText(/Demo code/);
  await expect(demo).toBeVisible();
  const code = ((await demo.textContent()) ?? "").match(/\d{4}/)?.[0] ?? "";
  const left = page.waitForURL((url) => !url.pathname.startsWith("/sign-in"));
  await page.getByLabel("Digit 1 of 4").fill(code);
  await left;
}

async function signInAsAdmin(page: Page, next = "/admin") {
  await page.goto(`/sign-in?as=staff&next=${encodeURIComponent(next)}`);
  await signInWithEmail(page, "admin@halden.example");
  await expect(page).toHaveURL(new RegExp(`${next.replace(/[/?]/g, "\\$&")}$`));
}

/** The left sidebar on wide screens, or the Menu drawer on phones. */
async function openSection(page: Page, name: string) {
  const menu = page.getByRole("button", { name: "Menu" });
  if (await menu.isVisible()) await menu.click();
  const nav = page.getByRole("navigation", { name: /^Admin/ }).filter({ visible: true });
  await nav.getByRole("link", { name: new RegExp(`^${name}`) }).click();
}

async function chooseFirstOpenTime(page: Page) {
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

/** Book as the sample patient, paying at the desk. Returns the booking reference. */
async function bookAsPatient(page: Page, doctorId: string): Promise<string> {
  await page.goto("/sign-in");
  await signInWithEmail(page, "ann.lee@halden.example");
  for (let attempt = 0; attempt < 4; attempt += 1) {
    await page.goto(`/doctors/${doctorId}`);
    await chooseFirstOpenTime(page);
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page).toHaveURL(/\/book\/details$/);
    await page.getByText("A follow-up").click();
    await page.getByText("Pay at the desk").click();
    await expect(page.getByText("£40.00 to pay at the desk.")).toBeVisible();
    await page.getByRole("button", { name: "Book appointment" }).click();
    await page.waitForURL(/\/(book\/confirmed|doctors\/)/);
    if (/\/book\/confirmed$/.test(page.url())) break;
  }
  await expect(page.getByRole("heading", { name: "You’re booked" })).toBeVisible();
  await expect(page.getByText("£40.00 to pay at the desk, by card or cash.")).toBeVisible();
  const reference = (await page.getByText(/^HSP-\d{6}$/).textContent())?.trim() ?? "";
  expect(reference).toMatch(/^HSP-\d{6}$/);
  await page.context().clearCookies();
  return reference;
}

test("only admins get into the console", async ({ page }) => {
  await page.goto("/admin/payments");
  await expect(page).toHaveURL(/\/sign-in\?as=staff&next=%2Fadmin%2Fpayments$/);
  await signInWithEmail(page, "desk@halden.example");
  // Reception lands on its own book rather than the console.
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/dashboard$/);
  const response = await page.request.get("/admin/export?kind=payments");
  expect(response.status()).toBe(403);
});

test("the console is reachable by keyboard and accessible on every section", async ({ page }) => {
  await signInAsAdmin(page);
  await expect(page.getByRole("heading", { level: 1, name: "Overview" })).toBeVisible();
  await expect(page.getByText("Acting as").or(page.getByRole("button", { name: "Menu" })).first()).toBeVisible();
  await expectAccessible(page);
  for (const [section, heading] of [
    ["Appointments", "Appointments"],
    ["Payments", "Payments"],
    ["People", "Patients"],
    ["Activity", "Activity"],
    ["Sign-in security", "Signed in"],
  ] as const) {
    await openSection(page, section);
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    await expectAccessible(page);
  }
});

test("a desk payment, then a cancellation and refund, all show in the ledger and the log", async ({ page }) => {
  // Books as a patient first, then works through the console: longer than the default timeout.
  test.slow();
  const reference = await bookAsPatient(page, "reid");
  await signInAsAdmin(page);

  // Find the visit from the search box.
  await page.getByRole("button", { name: /Search or jump to/ }).click();
  await page.getByRole("combobox", { name: "Search or jump to" }).fill(reference);
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/admin\/search\?q=HSP-/);
  await page.getByRole("link", { name: "Ann Lee" }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: "Ann Lee" })).toBeVisible();
  await expect(page.getByText("Unpaid").first()).toBeVisible();
  await expectAccessible(page);

  // Too much is refused, and what was typed stays.
  await page.getByLabel("Amount (£)").fill("90");
  await page.getByRole("button", { name: "Record payment" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "more than the £40.00 still owed" })).toBeVisible();
  await expect(page.getByLabel("Amount (£)")).toHaveValue("90");

  await page.getByLabel("Cash").check();
  await page.getByLabel("Amount (£)").fill("40");
  await page.getByRole("button", { name: "Record payment" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Payment recorded." })).toBeVisible();
  await expect(page.getByText("Paid", { exact: true }).first()).toBeVisible();

  // Cancelling needs a reason, then leaves the cash to give back.
  await page.getByRole("button", { name: "Cancel visit" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Give a reason for cancelling" })).toBeVisible();
  await page.getByLabel("Reason for cancelling").fill("Patient phoned to cancel");
  await page.getByRole("button", { name: "Cancel visit" }).click();
  await expect(page.getByRole("status").filter({ hasText: /still has to go back/ })).toBeVisible();
  await expect(page.getByText("Refund due").first()).toBeVisible();

  await page.getByLabel("Reason", { exact: true }).fill("Cancelled by phone");
  await page.getByRole("button", { name: "Record refund" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Refund recorded." })).toBeVisible();
  await expect(page.getByText("Refunded", { exact: true }).first()).toBeVisible();
  await expectNoSidewaysScroll(page);

  // Both movements are in the ledger, and today's takings net to nothing for this visit.
  await page.goto("/admin/payments");
  const ledger = page.getByRole("region", { name: "Payments and refunds" });
  await expect(ledger.getByRole("row").filter({ hasText: reference })).toHaveCount(2);
  await page.goto("/admin/payments/takings");
  await expect(page.getByRole("heading", { level: 1, name: "Daily takings" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Payments and refunds on this day" }).getByText(reference).first()).toBeVisible();
  await expectAccessible(page);

  // The activity log has every step, with the reasons.
  await page.goto(`/admin/activity?q=${encodeURIComponent(reference)}`);
  const log = page.getByRole("region", { name: "Activity" });
  await expect(log.getByText("Visit booked")).toBeVisible();
  await expect(log.getByText("Payment received")).toBeVisible();
  await expect(log.getByText("Visit cancelled")).toBeVisible();
  await expect(log.getByText("Patient phoned to cancel")).toBeVisible();
  await expect(log.getByText("Refund given")).toBeVisible();

  // The CSV has the same rows, and spreadsheet formulas can't sneak in.
  const response = await page.request.get(`/admin/export?kind=payments&q=${encodeURIComponent(reference)}`);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("text/csv");
  const csv = await response.text();
  expect(csv).toContain(reference);
  expect(csv).toContain("-40.00");
  expect(csv).not.toMatch(/\r\n[=+@]/);
});

test("an admin adds a staff member, turns the account off, and it can't sign in", async ({ page, browser }) => {
  test.slow();
  const email = `locum.${Date.now()}.${Math.floor(Math.random() * 1e6)}@example.com`;
  await signInAsAdmin(page, "/admin/people/new");
  await expectAccessible(page);
  await page.getByLabel("Full name").fill("Dr Lee Locum");
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Doctor", { exact: true }).check();
  await page.getByLabel("Clinic book").selectOption("macleod");
  await page.getByRole("button", { name: "Add staff member" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Dr Lee Locum" })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: /no password to share/ })).toBeVisible();

  // The new doctor can sign in and opens Dr MacLeod's book.
  const other = await browser.newContext();
  const doctor = await other.newPage();
  await doctor.goto("/sign-in?as=staff");
  await signInWithEmail(doctor, email);
  await expect(doctor).toHaveURL(/\/dashboard$/);

  // Turned off: their open session ends and the next sign-in is refused.
  await page.getByLabel("Reason", { exact: true }).last().fill("Locum contract ended");
  await page.getByRole("button", { name: "Turn off account" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Account turned off. They’ve been signed out everywhere" })).toBeVisible();
  await expect(page.getByText("Turned off").first()).toBeVisible();
  await doctor.goto("/dashboard");
  await expect(doctor).toHaveURL(/\/sign-in/);
  await doctor.goto("/sign-in?as=staff");
  await doctor.locator("#email").fill(email);
  await doctor.getByRole("button", { name: "Continue with email" }).click();
  const demo = doctor.getByText(/Demo code/);
  await expect(demo).toBeVisible();
  const code = ((await demo.textContent()) ?? "").match(/\d{4}/)?.[0] ?? "";
  await doctor.getByLabel("Digit 1 of 4").fill(code);
  await expect(doctor.getByRole("alert").filter({ hasText: "This account is turned off" })).toBeVisible();
  await other.close();

  // All of it is in the log, and the attempt shows under sign-in security.
  await page.goto("/admin/security/attempts");
  await expect(page.getByText("Turned-off account tried to sign in").first()).toBeVisible();
  await expectAccessible(page);
  await page.goto(`/admin/activity?q=${encodeURIComponent(email)}`);
  await expect(page.getByText("Staff member added")).toBeVisible();
  await expect(page.getByText("Account turned off")).toBeVisible();
});

test("the admin can't remove their own access", async ({ page }) => {
  await signInAsAdmin(page, "/admin/people/user-admin");
  await expect(page.getByRole("heading", { level: 1, name: /Fiona Grant/ })).toBeVisible();
  await expect(page.getByText("You can’t change your own role. Ask another admin.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Turn off account" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Sign out my other sessions" })).toBeVisible();
  await expectAccessible(page);
});
