// Map page regressions. Tests tagged @smoke don't depend on specific data, so they also run
// against the live site after every deploy.
import { expect, mapReady, stageCentre, test } from "./fixtures";

test.describe("map page", () => {
  test("loads with totals, breakdown, map and partner ring @smoke @mobile", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("header")).toContainText(/Nepal Development Projects/i);
    await expect(page.locator("#counters")).toContainText("USD");
    await expect(page.locator("#counters")).toContainText(/project/i);
    await mapReady(page);
    await expect(page.locator(".maplibregl-canvas")).toBeVisible();
    await expect(page.locator("[data-ring-partner]").first()).toBeAttached();
  });

  test("hovering Nepal shows a summary card, clicking drills down @smoke", async ({ page }) => {
    await page.goto("/");
    await mapReady(page);
    const c = await stageCentre(page);
    await page.mouse.move(c.x - 20, c.y, { steps: 3 });
    await page.mouse.move(c.x, c.y, { steps: 3 });
    const tip = page.getByRole("tooltip");
    await expect(tip).toBeVisible();
    await expect(tip).toContainText(/Province/i);
    await page.mouse.click(c.x, c.y);
    await expect(page).toHaveURL(/area=P\d/);
    await expect(page.locator("#breadcrumb button")).toHaveCount(2);
    await expect(page.locator("#overview-panel h1")).toContainText(/Province/);
  });

  test("deep link to a district, then back up via the panel", async ({ page }) => {
    await page.goto("/?area=kathmandu");
    await expect(page.locator("#overview-panel h1")).toHaveText("Kathmandu");
    await mapReady(page);
    await page.getByRole("button", { name: /Back to Bagmati/ }).click();
    await expect(page).toHaveURL(/area=P3/);
    await expect(page.locator("#overview-panel h1")).toHaveText("Bagmati Province");
  });

  test("palika level loads its boundary file", async ({ page }) => {
    const palikas = page.waitForResponse((r) => r.url().includes("/geo/palikas/P4.topo.json") && r.ok());
    await page.goto("/?area=kaski");
    await palikas;
    await mapReady(page);
    await expect(page.getByRole("tab", { name: "Palikas" })).toBeVisible();
  });

  test("filters: partner filter changes totals and is shareable via the URL", async ({ page }) => {
    await page.goto("/");
    const before = await page.locator("#counters").innerText();
    await page.locator("#filter-button").click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("checkbox", { name: /Japan/ }).click();
    await dialog.getByRole("button", { name: /Show results/ }).click();
    await expect(page).toHaveURL(/partners=japan/);
    await expect(page.locator("#counters")).not.toHaveText(before);
    // the same URL reproduces the view
    await page.reload();
    await expect(page.getByRole("button", { name: "Japan" }).first()).toBeVisible();
    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect(page).not.toHaveURL(/partners=/);
  });

  test("year: clicking a bar in the trend chart filters to that year", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("group", { name: /per year/i }).getByRole("button").nth(5).click();
    await expect(page).toHaveURL(/year=\d{4}/);
  });

  test("breakdown tabs switch lists", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("tab", { name: "Sectors" }).click();
    await expect(page).toHaveURL(/tab=sectors/);
    await page.getByRole("tab", { name: "Provinces" }).click();
    await expect(page.locator("#breakdown li")).toHaveCount(7);
  });

  test("projects view → drawer → full project page @smoke", async ({ page }) => {
    await page.goto("/");
    await mapReady(page);
    await page.locator("#projects-toggle").click();
    await expect(page).toHaveURL(/view=projects/);
    await page.locator("#overview-panel li button").first().click();
    const drawer = page.getByRole("dialog");
    await expect(drawer).toBeVisible();
    const title = (await drawer.locator("h2").innerText()).trim();
    await drawer.getByRole("link", { name: /Open full page/ }).click();
    await expect(page).toHaveURL(/\/projects\//);
    await expect(page.locator("h1")).toHaveText(title);
  });

  test("search finds a district and opens it", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("textbox", { name: "Search" }).fill("Kaski");
    await page.getByRole("option").first().click();
    await expect(page).toHaveURL(/area=kaski/);
  });

  test("language switches to Romanized Nepali and is remembered @smoke", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("radio", { name: "NE" }).click();
    await expect(page.locator("header")).toContainText("Nepal Bikas Pariyojana");
    await page.reload();
    await expect(page.locator("header")).toContainText("Nepal Bikas Pariyojana");
    await page.getByRole("radio", { name: "EN" }).click();
    await expect(page.locator("header")).toContainText(/Nepal Development Projects/i);
  });

  test("currency switches to NPR", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("radio", { name: "NPR" }).click();
    await expect(page.locator("#counters")).toContainText("Rs");
    await expect(page).toHaveURL(/cur=NPR/);
  });

  test("3D mode and metric switch don't break the map", async ({ page }) => {
    await page.goto("/?area=P4");
    await mapReady(page);
    await page.getByRole("radio", { name: "3D" }).click();
    await expect(page).toHaveURL(/mode=3d/);
    await page.getByRole("radio", { name: "Projects" }).click();
    await expect(page).toHaveURL(/metric=count/);
    await page.waitForTimeout(1500);
  });

  test("guided tour opens from the Tour button", async ({ page }) => {
    await page.goto("/");
    await mapReady(page);
    await page.locator("#tour-button").click();
    await expect(page.locator(".driver-popover")).toBeVisible();
  });

  test("PNG export downloads an image", async ({ page }) => {
    await page.goto("/");
    await mapReady(page);
    await page.locator("#share-button").click();
    const dl = page.waitForEvent("download");
    await page.getByRole("menuitem", { name: /PNG/ }).click();
    expect((await dl).suggestedFilename()).toMatch(/\.png$/);
  });
});
