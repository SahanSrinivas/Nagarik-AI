import { test, expect } from "@playwright/test";

/**
 * Auth: the demo credential banners on both sign-in pages must work end to
 * end. These are the *only* routes a hackathon judge realistically uses
 * since signup creates a new citizen with 0 XP and nothing seeded.
 */

test("citizen demo credentials → /home renders", async ({ page }) => {
  await page.goto("/login");
  // Banner is fetched from /auth/demo-credentials, then rendered with a
  // "Use demo credentials" button that fills both inputs.
  await page.getByRole("button", { name: /use demo credentials/i }).click();
  await expect(page.locator("input").first()).not.toHaveValue("");
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL("**/home", { timeout: 20_000 });
  await expect(page.locator("body")).toContainText(/XP|wallet|report|verifier/i);
});

test("password eye toggles input type on /login", async ({ page }) => {
  await page.goto("/login");
  // Constrain to the textbox role so we don't also match the adjacent
  // "Show password" button (button has aria-label containing "Password").
  const pwd = page.getByRole("textbox", { name: /password/i });
  await pwd.fill("Sw33ney@8688");
  await expect(pwd).toHaveAttribute("type", "password");
  await page.getByRole("button", { name: /show password/i }).click();
  await expect(pwd).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: /hide password/i }).click();
  await expect(pwd).toHaveAttribute("type", "password");
});

test("demo banner is visible in SIGNUP mode too", async ({ page }) => {
  await page.goto("/login");
  // Toggle to signup mode.
  await page.getByRole("button", { name: /don't have an account/i }).click();
  // Banner should still be present (new behaviour as of UI refresh).
  await expect(page.getByText(/Don't want to register/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /use demo credentials/i })).toBeVisible();
});

test("dept demo: first account button signs supervisor in", async ({ page }) => {
  await page.goto("/dept-login");
  await expect(page.getByText(/demo accounts/i)).toBeVisible();
  // The first listed account is BBMP Roads supervisor.
  const firstAcct = page.locator("button:has-text('_supervisor')").first();
  await firstAcct.click();
  await page.getByRole("button", { name: /^sign in$/i }).click();
  // Supervisors land on /supervisor; crew leads land on /crew/<id>.
  await page.waitForURL(/\/(supervisor|crew\/)/, { timeout: 20_000 });
  await expect(page.locator("body")).toContainText(/ticket|dispatch|crew|dashboard/i);
});

test("Test nav tab is reachable from any public page", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: /^Test$/ }).click();
  await page.waitForURL("**/test-photos");
  await expect(page.locator("body")).toContainText(/case|before|after|pothole/i);
});
