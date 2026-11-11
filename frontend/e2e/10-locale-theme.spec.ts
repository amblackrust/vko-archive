import { expect, test, type Page } from "@playwright/test";
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

/** В шапке два выпадающих меню: первое — язык (полные названия), второе — «глаз»: тема и версия для слабовидящих. */
async function openHeaderMenu(page: Page, index: 0 | 1) {
  await page.locator('header button[aria-haspopup="true"]').nth(index).click();
}

test.describe("Сценарий 10. Язык и тема без потери состояния", () => {
  for (const template of PAGES) {
    test(`KZ/RU/EN и светлая/тёмная тема: ${template.split("?")[0].replace("{photo}", "<id>")}`, async ({ page }) => {
      const path = template.replace("{photo}", await documentId(DEMO_CODES.photoFirstShift));
      await page.goto(`/ru${path}`);
      const search = new URL(page.url()).search;
      const html = page.locator("html");
      // Государственный сайт открывается в светлой теме, какой бы ни была тема устройства.
      await expect(html).not.toHaveClass(/dark/);

      for (const [code, name] of [["kk", "Қазақша"], ["en", "English"], ["ru", "Русский"]] as const) {
        await openHeaderMenu(page, 0);
        await page.locator("header").getByRole("link", { name: new RegExp(name) }).click();
        await expect(page).toHaveURL(new RegExp(`/${code}/`));
        await expect(html).toHaveAttribute("lang", code);
        // Тот же объект и те же фильтры.
        expect(new URL(page.url()).search).toBe(search);
        expect(new URL(page.url()).pathname).toBe(`/${code}${path.split("?")[0]}`);
        await expect(page.getByText(/Application error|Internal Server Error/)).toHaveCount(0);
      }

      // Тема: в окне «глаза» первая группа — «Светлая / Тёмная».
      const theme = page.locator("header fieldset").first().getByRole("button");
      await openHeaderMenu(page, 1);
      await theme.nth(1).click();
      await expect(html).toHaveClass(/dark/);
      // Тема переживает смену языка и перезагрузку.
      await page.keyboard.press("Escape");
      await openHeaderMenu(page, 0);
      await page.locator("header").getByRole("link", { name: /English/ }).click();
      await expect(page).toHaveURL(/\/en\//);
      await expect(html).toHaveClass(/dark/);
      await page.reload();
      await expect(html).toHaveClass(/dark/);
      await openHeaderMenu(page, 1);
      await theme.nth(0).click();
      await expect(html).not.toHaveClass(/dark/);
    });
  }

  test("телефон: разделы открываются из меню на весь экран", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto("/ru");
    await page.getByRole("button", { name: "Открыть меню" }).click();
    const menu = page.getByRole("dialog", { name: "Меню" });
    await menu.locator("summary", { hasText: "Услуги" }).first().click();
    await menu.getByRole("link", { name: "Где искать документы" }).click();
    await expect(page).toHaveURL(/\/navigator$/);
  });

  test("мобильная ширина: страница без горизонтальной прокрутки", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    for (const path of ["", "/catalog", "/catalog?view=list", "/about", "/assistant", "/branches/branch-ridder"]) {
      await page.goto(`/ru${path}`);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, path).toBe(0);
    }
  });
});
