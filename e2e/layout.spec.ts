import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function expectAccessible(page: Page) {
  await page.waitForTimeout(800);
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

async function signInAsAnn(page: Page) {
  await page.goto("/sign-in?next=%2Fbook");
  await page.locator("#email").fill("ann.lee@halden.example");
  await page.getByRole("button", { name: "Continue with email" }).click();
  const demo = page.getByText(/Demo code/);
  await expect(demo).toBeVisible();
  const code = ((await demo.textContent()) ?? "").match(/\d{4}/)?.[0] ?? "";
  await page.getByLabel("Digit 1 of 4").fill(code);
  await expect(page).toHaveURL(/\/book$/);
}

/** Bottom edge of the sticky site header, in viewport pixels. */
async function headerBottom(page: Page): Promise<number> {
  const box = await page.locator("header").first().boundingBox();
  return box!.y + box!.height;
}

/** Pages rise into place after a navigation. Measure once that has finished. */
async function settle(page: Page) {
  await page.waitForFunction(() => {
    const wrapper = document.querySelector("main > div");
    const transform = wrapper ? getComputedStyle(wrapper).transform : "none";
    return transform === "none" || transform === "matrix(1, 0, 0, 1, 0, 0)";
  });
}

/** The pinned bar: the nearest sticky ancestor of the doctor search. Null if nothing is sticky. */
async function pinnedBar(page: Page) {
  return page.getByRole("searchbox", { name: "Search by name, specialty or language" }).evaluate((input) => {
    let node: Element | null = input;
    while (node && getComputedStyle(node).position !== "sticky") node = node.parentElement;
    if (!node) return null;
    const box = node.getBoundingClientRect();
    return { top: box.top, bottom: box.bottom, stuck: node.hasAttribute("data-stuck") };
  });
}

test("the practice is Westbrook, and there's no step-by-step bar while booking", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Westbrook Medical Practice/);
  await expect(page.getByRole("link", { name: "Westbrook Medical Practice" })).toBeVisible();

  await page.goto("/doctors/cho");
  await expect(page.getByRole("heading", { level: 1, name: "Dr Helen Cho" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Booking progress" })).toHaveCount(0);
  await expect(page.getByText("current step")).toHaveCount(0);
});

test("header: shows where you are and who is signed in; Menu on phones", async ({ page, isMobile }) => {
  await signInAsAnn(page);

  if (isMobile) {
    const menu = page.getByRole("button", { name: "Menu" });
    await expect(menu).toHaveAttribute("aria-expanded", "false");
    await menu.click();
    await expect(menu).toHaveAttribute("aria-expanded", "true");
    const nav = page.getByRole("navigation", { name: "Main" });
    await expect(nav.getByRole("link", { name: "Book a visit" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByText("ann.lee@halden.example")).toBeVisible();
    await expectAccessible(page);

    await page.keyboard.press("Escape");
    await expect(menu).toHaveAttribute("aria-expanded", "false");
    await expect(menu).toBeFocused();

    // Going somewhere from the menu closes it.
    await menu.click();
    await nav.getByRole("link", { name: "Appointments" }).click();
    await expect(page).toHaveURL(/\/appointments$/);
    await expect(menu).toHaveAttribute("aria-expanded", "false");
    return;
  }

  const nav = page.getByRole("navigation", { name: "Main" });
  await expect(nav.getByRole("link", { name: "Book a visit" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("button", { name: "Menu" })).toBeHidden();
  const account = page.getByRole("button", { name: "Ann Lee, account" });
  await account.click();
  await expect(page.getByText("ann.lee@halden.example")).toBeVisible();
  await expectAccessible(page);
  await page.keyboard.press("Escape");
  await expect(page.getByText("ann.lee@halden.example")).toBeHidden();
  await expect(account).toBeFocused();

  await nav.getByRole("link", { name: "Appointments" }).click();
  await expect(page).toHaveURL(/\/appointments$/);
  await expect(nav.getByRole("link", { name: "Appointments" })).toHaveAttribute("aria-current", "page");
});

test("booking page: greeting, search and filters stay pinned while the cards scroll under them", async ({ page }) => {
  await signInAsAnn(page);
  await settle(page);
  const heading = page.getByRole("heading", { level: 1, name: /Hi Ann, who would you like to see/ });
  const search = page.getByRole("searchbox", { name: "Search by name, specialty or language" });
  const chips = page.getByRole("radiogroup", { name: "Filter by specialty" });
  const cards = page.getByRole("list", { name: "Doctors" }).getByRole("link");
  await expect(cards).toHaveCount(5);
  expect((await pinnedBar(page))?.stuck).toBe(false);

  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(300);
  const bar = (await pinnedBar(page))!;
  expect(bar).not.toBeNull();
  expect(bar.stuck).toBe(true);
  // Directly under the header, with the greeting, search and filters all still on screen.
  expect(Math.abs(bar.top - (await headerBottom(page)))).toBeLessThan(1.5);
  await expect(heading).toBeInViewport();
  await expect(search).toBeInViewport();
  await expect(chips).toBeInViewport();
  // The cards went underneath it.
  expect((await cards.first().boundingBox())!.y).toBeLessThan(bar.bottom);

  // Tabbing from the bar back into the list: the focused item comes out from under the bar (WCAG 2.4.11).
  await search.focus();
  await page.keyboard.press("Tab"); // the selected chip
  await page.keyboard.press("Tab"); // first thing in the list area
  await page.waitForTimeout(300);
  const focusedTop = await page.evaluate(() => document.activeElement!.getBoundingClientRect().top);
  expect(focusedTop).toBeGreaterThanOrEqual(bar.bottom - 1);
  await expectAccessible(page);

  // Focusing the pinned search itself leaves the page where it is.
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(200);
  const scrolled = await page.evaluate(() => window.scrollY);
  await search.focus();
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => window.scrollY)).toBe(scrolled);
});

test("landing page: search and filters ride along with the doctor cards, then let go", async ({ page }) => {
  await page.goto("/");
  const search = page.getByRole("searchbox", { name: "Search by name, specialty or language" });
  const chips = page.getByRole("radiogroup", { name: "Filter by specialty" });
  await page.getByRole("list", { name: "Doctors" }).getByRole("link").last().scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await expect(search).toBeInViewport();
  await expect(chips).toBeInViewport();
  const bar = (await pinnedBar(page))!;
  expect(bar.stuck).toBe(true);
  expect(Math.abs(bar.top - (await headerBottom(page)))).toBeLessThan(1.5);
  // The introduction scrolled away; only the finder is pinned.
  await expect(page.getByRole("heading", { name: "Meet our doctors" })).not.toBeInViewport();

  // Filtering from deep in the list brings the results up to just under the bar.
  await chips.getByRole("radio", { name: "Diabetes" }).click();
  await expect(page.getByText("1 doctor in diabetes")).toBeInViewport();
  await expect(page.getByRole("link", { name: /Dr Callum Reid/ })).toBeInViewport();
  await chips.getByRole("radio", { name: "All doctors" }).click();

  // At the bottom of the page the bar stays inside its section: it never covers what comes after the doctors.
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(300);
  const end = (await pinnedBar(page))!;
  const nextSection = (await page.getByRole("heading", { name: "Good to know" }).boundingBox())!;
  expect(end.bottom).toBeLessThanOrEqual(nextSection.y);
});

test("on a short screen the bar scrolls with the page instead of covering it", async ({ page }) => {
  // A phone on its side, or a zoomed-in window (WCAG technique C34).
  await page.setViewportSize({ width: 740, height: 360 });
  await page.goto("/");
  expect(await pinnedBar(page)).toBeNull();
});

test("tabbing into the header from far down the page doesn't scroll back to the top", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(200);
  const before = await page.evaluate(() => window.scrollY);
  expect(before).toBeGreaterThan(500);
  await page.locator("header").getByRole("link", { name: "Westbrook Medical Practice" }).focus();
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => window.scrollY)).toBe(before);
});

test("nothing spills sideways on a 320px screen (WCAG 1.4.10 reflow)", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  for (const path of ["/", "/doctors/cho"]) {
    await page.goto(path);
    const header = await page.locator("header > div").first().evaluate((row) => row.scrollWidth - row.clientWidth);
    expect(header, `${path} header`).toBeLessThanOrEqual(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), `${path} page`).toBeLessThanOrEqual(0);
  }
  await signInAsAnn(page);
  const header = await page.locator("header > div").first().evaluate((row) => row.scrollWidth - row.clientWidth);
  expect(header, "/book header").toBeLessThanOrEqual(0);
  await expect(page.getByRole("button", { name: "Menu" })).toBeVisible();
});
