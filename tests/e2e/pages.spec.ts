import fs from "node:fs";
import { expect, test } from "./fixtures";

test.describe("data page", () => {
  test("lists projects with pagination @smoke @mobile", async ({ page }) => {
    await page.goto("/data");
    await expect(page.locator("h1")).toHaveText("Project data");
    const rows = page.locator("tbody tr");
    await expect(rows.first()).toBeVisible();
    expect(await rows.count()).toBeLessThanOrEqual(20);
  });

  test("sorting by project name orders the rows", async ({ page }) => {
    await page.goto("/data");
    await page.locator("th", { hasText: "Project" }).getByRole("button").click();
    const sorted = page.locator("th[aria-sort]", { hasText: "Project" });
    await expect(sorted).not.toHaveAttribute("aria-sort", "none");
    const titles = await page.locator("tbody tr td:first-child").allInnerTexts();
    const dir = await sorted.getAttribute("aria-sort");
    const expected = [...titles].sort((a, b) => a.localeCompare(b));
    expect(titles).toEqual(dir === "ascending" ? expected : expected.reverse());
  });

  test("map filters carry over and CSV export matches the table", async ({ page }) => {
    await page.goto("/data?partners=japan");
    await expect(page.getByRole("button", { name: /Japan/ }).first()).toBeVisible();
    const shown = await page.locator("tbody tr").count();
    const dl = page.waitForEvent("download");
    await page.getByRole("button", { name: /Download CSV/ }).click();
    const csv = fs.readFileSync((await (await dl).path())!, "utf8").replace(/^\uFEFF/, "").trim().split("\n");
    expect(csv[0]).toContain("project");
    expect(csv.length - 1).toBe(shown); // fewer than 20 Japan projects -> one page
    expect(csv.slice(1).every((l) => l.includes("Japan"))).toBe(true);
  });
});

test.describe("project page", () => {
  test("unknown project returns 404 @smoke", async ({ page, errors }) => {
    const res = await page.goto("/projects/does-not-exist");
    expect(res?.status()).toBe(404);
    // the browser logs the 404 we asked for; anything else is still an error
    errors.splice(0, errors.length, ...errors.filter((e) => !/status of 404/.test(e)));
  });

  test("renders key facts, transactions and a back link", async ({ page }) => {
    await page.goto("/projects/SAMPLE-001");
    await expect(page.locator("h1")).not.toBeEmpty();
    await expect(page.getByText("Key facts")).toBeVisible();
    await expect(page.getByText("Transaction history")).toBeVisible();
    await page.getByRole("link", { name: /Back to map/ }).click();
    await expect(page).toHaveURL(/\/(\?.*)?$/);
  });
});

test.describe("static assets", () => {
  test("boundary files, glyphs and area index are served @smoke", async ({ request }) => {
    for (const p of ["/geo/nepal.topo.json", "/geo/areas.json", "/geo/neighbours.topo.json", "/geo/palikas/P7.topo.json", "/glyphs/Noto%20Sans%20Medium/0-255.pbf"]) {
      const r = await request.get(p);
      expect(r.status(), p).toBe(200);
    }
  });
});
