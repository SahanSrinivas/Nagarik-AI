import { test, expect } from "@playwright/test";

/**
 * Report submission — the only mutating test in the suite. Skipped unless
 * E2E_MUTATE=1 is set, so CI smoke runs don't pile up demo tickets on prod.
 *
 *   E2E_MUTATE=1 npx playwright test 03-report
 */

const SHOULD_MUTATE = process.env.E2E_MUTATE === "1";

test.describe("report submission (mutating)", () => {
  test.skip(!SHOULD_MUTATE, "Set E2E_MUTATE=1 to actually post an issue.");

  test("citizen creates issue via API → tracking page renders", async ({ request, page }) => {
    // 1. Get a citizen JWT from the demo credentials endpoint.
    const creds = await (await request.get("https://api.nagarikai.xyz/auth/demo-credentials")).json();
    const tok   = await request.post("https://api.nagarikai.xyz/auth/login", {
      data: { username: creds.username, password: creds.password },
    });
    expect(tok.status(), "login").toBe(200);
    const { access_token } = await tok.json();

    // 2. POST /issues with a test photo URL. This is the exact route that
    //    422'd before we removed the broken @limiter.limit decorator.
    const submit = await request.post("https://api.nagarikai.xyz/issues", {
      headers: { Authorization: `Bearer ${access_token}` },
      data: {
        lat: 12.97, lng: 77.59,
        description: "Playwright e2e — Case A pothole",
        before_photo_url: "https://nagarikai.xyz/test-photos/case_a_reported.jpg",
      },
    });
    expect(submit.status(), "issues create").toBe(201);
    const issue = await submit.json();
    expect(issue.id).toBeTruthy();

    // 3. Tracking page for that issue renders without a fatal error.
    await page.goto(`/tracking/${issue.id}`);
    await expect(page.locator("body")).toContainText(/status|agent|timeline|pothole/i);
  });
});

test("report form page loads form controls (read-only)", async ({ page }) => {
  // /report is auth-gated. Use the citizen demo credentials to get past it.
  await page.goto("/login");
  await page.getByRole("button", { name: /use demo credentials/i }).click();
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL("**/home", { timeout: 20_000 });
  await page.goto("/report");
  // The description input is a <textarea> — name from the label varies by
  // i18n (EN/हि/ಕ) so don't pin to placeholder text.
  await expect(page.locator("textarea").first()).toBeVisible({ timeout: 15_000 });
});
