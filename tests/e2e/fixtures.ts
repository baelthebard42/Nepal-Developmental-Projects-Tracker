import { test as base, expect, type Page } from "@playwright/test";

/** Every test fails if the page logs an error or throws (hydration mismatches, WebGL errors…). */
export const test = base.extend<{ errors: string[] }>({
  errors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
      page.on("console", (m) => {
        if (m.type() !== "error") return;
        const text = m.text();
        // network noise that isn't an app bug (e.g. an aborted font request)
        if (/net::ERR_ABORTED|favicon/.test(text)) return;
        errors.push(`console: ${text}`);
      });
      // don't auto-start the guided tour (it is tested explicitly)
      await page.addInitScript(() => {
        try {
          localStorage.setItem("npm-tour-seen", "1");
        } catch {}
      });
      await use(errors);
      expect(errors, errors.join("\n")).toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

/** wait until MapLibre has loaded the style and the boundary data */
export async function mapReady(page: Page) {
  await expect(page.locator("[data-map-ready=true]")).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(800); // choropleth state is applied right after the sources load
}

/** centre of the map stage, which is always over Nepal at the national view */
export async function stageCentre(page: Page) {
  const box = (await page.locator("#map-stage").boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}
