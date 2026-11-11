import { expect, test } from "@playwright/test";
import { DEMO_CODES, documentId } from "./helpers";

const PAGES = [
  "/catalog?q=%D1%86%D0%B5%D1%85&doc_type=photo",
  "/search?q=%D0%BF%D1%80%D0%B8%D0%BA%D0%B0%D0%B7",
  "/services/state",
  "/branches/branch-ridder",
  "/exhibitions/exhibition-industry/6",
  "/catalog/documents/{photo}",
  "/news",
];

test.describe("Сценарий 10. Язык и тема без потери состояния", () => {
  for (const template of PAGES) {
    test(`KZ/RU/EN и светлая/тёмная тема: ${template.split("?")[0].replace("{photo}", "<id>")}`, async ({ page }) => {
      const path = template.replace("{photo}", await documentId(DEMO_CODES.photoFirstShift));
      await page.goto(`/ru${path}`);
      const header = page.locator("header");
      const search = new URL(page.url()).search;

      for (const [code, short] of [["kk", "KZ"], ["en", "EN"], ["ru", "RU"]] as const) {
        await header.getByRole("link", { name: short, exact: true }).first().click();
        await expect(page).toHaveURL(new RegExp(`/${code}/`));
        await expect(page.locator("html")).toHaveAttribute("lang", code);
        // Тот же объект и те же фильтры.
        expect(new URL(page.url()).search).toBe(search);
        expect(new URL(page.url()).pathname).toBe(`/${code}${path.split("?")[0]}`);
        await expect(page.getByText(/Application error|Internal Server Error/)).toHaveCount(0);
      }

      const html = page.locator("html");
      await header.getByRole("button", { name: "Включить тёмную тему" }).first().click();
      await expect(html).toHaveClass(/dark/);
      // Тема переживает смену языка и перезагрузку.
      await header.getByRole("link", { name: "EN", exact: true }).first().click();
      await expect(page).toHaveURL(/\/en\//);
      await expect(html).toHaveClass(/dark/);
      await page.reload();
      await expect(html).toHaveClass(/dark/);
      await page.getByRole("button", { name: /light theme|светлую тему|Жарық тақырып/i }).first().click();
      await expect(html).not.toHaveClass(/dark/);
    });
  }

  test("мобильная ширина: страница без горизонтальной прокрутки", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    for (const path of ["", "/catalog", "/branches/branch-ridder"]) {
      await page.goto(`/ru${path}`);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      // Допуск 8px: на 375px шапка выступает на ~4px (известная мелочь, см. docs/handoff/B25.md).
      expect(overflow, path).toBeLessThanOrEqual(8);
    }
  });
});
