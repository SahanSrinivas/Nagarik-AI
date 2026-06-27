import { defineConfig, devices } from "@playwright/test";

/**
 * Hits the live nagarikai.xyz deployment. Workers=1 keeps load on the
 * Cloud Run instance light (it scales to zero between demos). Set
 * BASE_URL=http://localhost:3000 to point at the dev server instead.
 */
export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.BASE_URL ?? "https://nagarikai.xyz",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
});
