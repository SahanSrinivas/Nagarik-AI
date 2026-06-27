import { test, expect } from "@playwright/test";

/**
 * Smoke: each public page returns 200, renders without a fatal client error,
 * and shows a recognisable bit of copy. Catches the "deploy broke the bundle"
 * class of regression in under 30 s.
 */
const PAGES = [
  { path: "/",              expectText: "NagarikAI" },
  { path: "/report",        expectText: /report|photo|describe/i },
  { path: "/map",           expectText: /map|ward|heatmap/i },
  { path: "/dashboard",     expectText: /ward|complaint|backlog/i },
  { path: "/crew",          expectText: /crew|department/i },
  { path: "/milp",          expectText: /schedul|MILP|crew/i },
  { path: "/impact",        expectText: /veer|leaderboard|XP/i },
  { path: "/references",    expectText: /dataset|reference|source/i },
  { path: "/test-photos",   expectText: /test|case|before|after/i },
  { path: "/architecture",  expectText: /architecture|agent|pipeline/i },
  { path: "/login",         expectText: /sign in|create|account/i },
  { path: "/dept-login",    expectText: /department|BBMP|supervisor/i },
];

for (const { path, expectText } of PAGES) {
  test(`smoke · ${path} loads + renders`, async ({ page }) => {
    const errs: string[] = [];
    page.on("pageerror", (e) => errs.push(e.message));
    const r = await page.goto(path);
    expect(r?.status(), `HTTP status for ${path}`).toBeLessThan(400);
    await expect(page.locator("body")).toContainText(expectText);
    expect(errs, `console pageerrors on ${path}`).toEqual([]);
  });
}

test("smoke · API /health responds prod ok", async ({ request }) => {
  const r = await request.get("https://api.nagarikai.xyz/health");
  expect(r.status()).toBe(200);
  await expect.poll(async () => (await r.json()).status).toBe("ok");
});
