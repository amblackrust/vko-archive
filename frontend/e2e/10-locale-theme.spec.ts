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

/** Язык, тема и версия для слабовидящих собраны в боковом меню: его открывает последняя кнопка шапки. */
async function openMenu(page: Page) {
  await page.locator('header button[aria-haspopup="dialog"]').last().click();
  const menu = page.getByRole("dialog");
  await expect(menu).toBeVisible();
  return menu;
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
        const menu = await openMenu(page);
        await menu.getByRole("link", { name, exact: true }).click();
        await expect(page).toHaveURL(new RegExp(`/${code}/`));
        await expect(html).toHaveAttribute("lang", code);
        // Тот же объект и те же фильтры.
        expect(new URL(page.url()).search).toBe(search);
        expect(new URL(page.url()).pathname).toBe(`/${code}${path.split("?")[0]}`);
        await expect(page.getByText(/Application error|Internal Server Error/)).toHaveCount(0);
      }

      // Тема: кнопки «Светлая / Тёмная / Как в системе» — первая группа в меню.
      let menu = await openMenu(page);
      await menu.getByRole("button", { name: "Тёмная", exact: true }).click();
      await expect(html).toHaveClass(/dark/);
      // Тема переживает смену языка и перезагрузку.
      await menu.getByRole("link", { name: "English", exact: true }).click();
      await expect(page).toHaveURL(/\/en\//);
      await expect(html).toHaveClass(/dark/);
      await page.reload();
      await expect(html).toHaveClass(/dark/);
      menu = await openMenu(page);
      await menu.locator("fieldset").first().getByRole("button").first().click();
      await expect(html).not.toHaveClass(/dark/);
    });
  }

  test("мобильная ширина: страница без горизонтальной прокрутки", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    for (const path of ["", "/catalog", "/catalog?view=list", "/about", "/assistant", "/branches/branch-ridder"]) {
      await page.goto(`/ru${path}`);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, path).toBe(0);
    }
  });
});
