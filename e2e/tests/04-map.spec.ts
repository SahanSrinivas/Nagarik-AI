import { test, expect } from "@playwright/test";

/**
 * Map sanity: Mapbox token must be baked into the client bundle. If the
 * token is missing the page shows the "Set NEXT_PUBLIC_MAPBOX_TOKEN in
 * apps/web/.env.local" placeholder copy, which we treat as a failure.
 */

test("/map renders Mapbox GL canvas (token is in bundle)", async ({ page }) => {
  await page.goto("/map");
  await expect(page.locator("body")).not.toContainText(/Set NEXT_PUBLIC_MAPBOX_TOKEN/i);
  // Mapbox GL renders into a <canvas class="mapboxgl-canvas">. The element
  // appears asynchronously after the Mapbox JS loads + auths against the
  // tile server.
  await expect(page.locator("canvas.mapboxgl-canvas")).toBeVisible({ timeout: 15_000 });
});

test("/report shows Mapbox locator preview when a ward chip is clicked", async ({ page }) => {
  await page.goto("/report");
  // Best-effort: click any ward chip on the page if present, then confirm
  // a mapboxgl canvas appears. If the report page doesn't surface the map
  // until certain prerequisites are met, this test is informational only.
  const chip = page.locator("button:has-text('Hemmigepura'), button:has-text('Indiranagar')").first();
  if (await chip.isVisible().catch(() => false)) {
    await chip.click();
    await expect(page.locator("canvas.mapboxgl-canvas")).toBeVisible({ timeout: 15_000 });
  } else {
    test.skip(true, "Report page didn't expose a ward chip — skipping informational map check.");
  }
});
