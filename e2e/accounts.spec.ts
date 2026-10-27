import { expect, test } from "@playwright/test";

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
  await page.getByRole("button", { name: /sample patient, Ann Lee/ }).click();
  await expect(page).toHaveURL(/\/appointments$/);
  await expect(page.getByRole("heading", { name: "Your appointments" })).toBeVisible();

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

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/$/);

  await page.goto("/sign-in?as=staff");
  await page.getByRole("button", { name: "Sign in as Dr Callum Reid" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Clinic book" })).toBeVisible();
  await expect(page.getByText(reference)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ann Lee" }).first()).toBeVisible();
});

test("a new patient can register, keeping what they typed after a mistake", async ({ page }) => {
  const email = `new.${Date.now()}.${Math.floor(Math.random() * 1e6)}@example.com`;
  await page.goto("/register");
  await page.getByLabel("Full name").fill("Sam Patel");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("long-enough-pw");
  await page.getByLabel("Date of birth").fill("1990-05-01");
  await page.getByLabel("Mobile number").fill("12345");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "1 thing to fix" })).toBeVisible();
  await expect(page.getByLabel("Full name")).toHaveValue("Sam Patel");
  await expect(page.getByLabel("Email")).toHaveValue(email);

  await page.getByLabel("Mobile number").fill("07700 900456");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/appointments$/);
  await expect(page.getByText("Signed in as Sam Patel")).toBeVisible();
});

test("clinic staff cannot book as a patient", async ({ page }) => {
  await page.goto("/sign-in?as=staff");
  await page.getByRole("button", { name: "Sign in as Halden Street desk" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await page.goto("/book/details");
  await expect(page.getByRole("heading", { name: "Patients book here" })).toBeVisible();
});
