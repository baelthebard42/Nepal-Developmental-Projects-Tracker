// Screenshot helper: node scripts/screens/shot.mjs <url> <out.png> [width] [height] [actions-json]
// actions: [{"hover":[x,y]}, {"click":[x,y]}, {"wait":ms}, {"clickSel":"#id"}]
import { chromium } from "playwright-core";
const [url, out, w = "1440", h = "900", actions = "[]"] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 2500)));
page.on("pageerror", (e) => errors.push("PAGEERROR " + (e.stack || e.message).slice(0, 2500)));
await page.addInitScript(() => localStorage.setItem("npm-tour-seen", "1"));
await page.goto(url, { waitUntil: "load" });
await page.waitForTimeout(3500);
for (const a of JSON.parse(actions)) {
  if (a.hover) await page.mouse.move(a.hover[0], a.hover[1], { steps: 4 });
  if (a.click) await page.mouse.click(a.click[0], a.click[1]);
  if (a.clickSel) await page.click(a.clickSel);
  if (a.hoverSel) await page.hover(a.hoverSel);
  if (a.wait) await page.waitForTimeout(a.wait);
  if (a.cookie) { await page.context().addCookies([{ name: "npm-locale", value: a.cookie, url: url }]); await page.reload({ waitUntil: "load" }); await page.waitForTimeout(3000); }
  if (a.eval) console.log("EVAL", JSON.stringify(await page.evaluate(a.eval)));
}
await page.waitForTimeout(800);
await page.screenshot({ path: out });
console.log(errors.length ? "ERRORS:\n" + [...new Set(errors)].join("\n") : "no console errors");
await browser.close();
