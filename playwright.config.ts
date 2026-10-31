import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

export default defineConfig({
  testDir: "./e2e",
  // Tests share the sample accounts, and each sign-in replaces that account’s code.
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } } },
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } } },
  ],
  webServer: {
    // No mail key in tests: the sign-in page shows the code instead of emailing it.
    // Its own database, emptied each run, so tests never fill up (or write to) the dev clinic book.
    command: `rm -rf .e2e && npm run build && CLINIC_DB=.e2e/clinic.sqlite SHOW_LOGIN_CODES=1 npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
