import { expect, test, type Page } from "@playwright/test";

const DEMO_PASSWORD = "Halden-demo-2026";
const NEW_PASSWORD = "e2e-password-2026";

/** Sample accounts sign in with the demo password; any other email signs up as a patient. */
async function signInWithEmail(page: Page, email: string, name = "Sam Patel") {
  const left = page.waitForURL((url) => !url.pathname.startsWith("/sign-in"));
  if (email.endsWith("@halden.example")) {
    await page.locator("#email").fill(email);
    await page.locator("#password").fill(DEMO_PASSWORD);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
  } else {
    await page.getByRole("button", { name: "Create an account" }).click();
    await page.locator("#name").fill(name);
    await page.locator("#email").fill(email);
    await page.locator("#password").fill(NEW_PASSWORD);
    await page.locator("#confirm").fill(NEW_PASSWORD);
    await page.getByRole("button", { name: "Create account", exact: true }).click();
  }
  await left;
}

/** Sign-out lives in the account menu on desktop and in Menu on phones. */
async function signOut(page: Page) {
  const account = page.getByRole("button", { name: /, account$/ });
  await ((await account.isVisible()) ? account : page.getByRole("button", { name: "Menu" })).click();
  await page.getByRole("button", { name: "Sign out" }).click();
}

async function chooseFirstOpenTime(page: import("@playwright/test").Page) {
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

test("a patient booking appears on that doctor’s clinic book", async ({ page }) => {
  await page.goto("/sign-in");
  await signInWithEmail(page, "ann.lee@halden.example");
  await expect(page).toHaveURL(/\/book$/);
  await expect(page.getByRole("heading", { level: 1, name: /Hi Ann/ })).toBeVisible();

  await page.goto("/doctors/reid");
  await chooseFirstOpenTime(page);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByLabel("Full name")).toHaveValue("Ann Lee");
  await page.getByText("A follow-up").click();
  await page.getByRole("button", { name: "Book appointment" }).click();
  await page.waitForURL(/\/(book\/confirmed|doctors\/)/);
  if (!/\/book\/confirmed$/.test(page.url())) {
    await chooseFirstOpenTime(page);
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByText("A follow-up").click();
    await page.getByRole("button", { name: "Book appointment" }).click();
    await expect(page).toHaveURL(/\/book\/confirmed$/);
  }

  const reference = (await page.getByText(/^HSP-\d{6}$/).textContent())?.trim() ?? "";
  expect(reference).toMatch(/^HSP-\d{6}$/);

  await page.goto("/appointments");
  await expect(page.getByText(reference)).toBeVisible();

  await signOut(page);
  await expect(page).toHaveURL(/\/$/);

  await page.goto("/sign-in?as=staff");
  await signInWithEmail(page, "callum.reid@halden.example");
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Clinic book" })).toBeVisible();
  await expect(page.getByText(reference)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ann Lee" }).first()).toBeVisible();
});

test("a new patient signs up with just an email and their name", async ({ page }) => {
  const email = `new.${Date.now()}.${Math.floor(Math.random() * 1e6)}@example.com`;
  await page.goto("/register");
  await expect(page).toHaveURL(/\/sign-in$/);
  await signInWithEmail(page, email, "Sam Patel");
  await expect(page).toHaveURL(/\/book$/);
  await expect(page.getByRole("heading", { level: 1, name: /Hi Sam/ })).toBeVisible();
});

test("clinic staff cannot book as a patient", async ({ page }) => {
  await page.goto("/sign-in?as=staff");
  await signInWithEmail(page, "desk@halden.example");
  await expect(page).toHaveURL(/\/dashboard/);
  await page.goto("/book/details");
  await expect(page.getByRole("heading", { name: "Patients book here" })).toBeVisible();
});
