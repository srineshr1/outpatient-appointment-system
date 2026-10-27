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
  await page.getByRole("button", { name: "Sign in as Ann Lee" }).click();
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

  const reference = (await page.getByText(/^HSP-\d{4}$/).textContent())?.trim() ?? "";
  expect(reference).toMatch(/^HSP-\d{4}$/);

  await page.goto("/appointments");
  await expect(page.getByText(reference)).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/$/);

  await page.goto("/sign-in");
  await page.getByRole("button", { name: "Sign in as Dr Callum Reid" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Clinic book" })).toBeVisible();
  await expect(page.getByText(reference)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ann Lee" })).toBeVisible();
});
