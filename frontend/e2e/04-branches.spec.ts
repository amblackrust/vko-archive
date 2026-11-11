import { expect, test } from "@playwright/test";

test.describe("Сценарий 4. Поиск филиала", () => {
  test("выбор филиала и внешние ссылки маршрута", async ({ page }) => {
    await page.goto("/ru/branches");
    await expect(page.getByText("Найдено филиалов: 14")).toBeVisible();
    await page.locator("#branch-branch-ridder").click();
    // Выбор на карте/в списке открывает панель с маршрутом; затем страница филиала.
    await expect(page.getByRole("link", { name: /2GIS/ })).toBeVisible();
    await page.getByRole("link", { name: "Страница филиала" }).click();
    await expect(page).toHaveURL(/\/branches\/branch-ridder/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Риддер");
    for (const name of [/2GIS/, /Google Maps/, /Яндекс Картах/]) {
      const link = page.getByRole("link", { name });
      await expect(link).toHaveAttribute("target", "_blank");
      expect(await link.getAttribute("href")).toContain("%D0%A0%D0%B8%D0%B4%D0%B4%D0%B5%D1%80");
    }
  });

  test("отказ от геолокации: понятное сообщение, ссылки на карты остаются", async ({ page }) => {
    await page.goto("/ru/branches/branch-ridder");
    await page.getByRole("button", { name: "Использовать моё местоположение" }).click();
    await expect(page.locator("p[role=alert]")).toBeVisible();
    await expect(page.getByRole("link", { name: /2GIS/ })).toBeVisible();
  });

  test("маршрут по введённому адресу (геокодер подменён)", async ({ page }) => {
    await page.route("https://nominatim.openstreetmap.org/**", (route) =>
      route.fulfill({ json: [{ lat: "49.9487", lon: "82.6283" }], headers: { "access-control-allow-origin": "*" } }),
    );
    await page.goto("/ru/branches/branch-ridder");
    const before = await page.getByRole("link", { name: /Google Maps/ }).getAttribute("href");
    await page.locator("#route-from").fill("Усть-Каменогорск");
    await page.locator("form:has(#route-from) button[type=submit]").click();
    await expect(page.getByRole("status").filter({ hasText: /км|отправления/i })).toBeVisible();
    expect(await page.getByRole("link", { name: /Google Maps/ }).getAttribute("href")).not.toBe(before);
  });

  test("геокодер недоступен: сообщение об ошибке, страница работает", async ({ page }) => {
    await page.route("https://nominatim.openstreetmap.org/**", (route) => route.abort());
    await page.goto("/ru/branches/branch-ridder");
    await page.locator("#route-from").fill("Нигде");
    await page.locator("form:has(#route-from) button[type=submit]").click();
    await expect(page.locator("p[role=alert]")).toBeVisible();
    await expect(page.locator('#main a[href^="tel:"]')).toBeVisible();
  });

  test("тайлы карты недоступны: адрес и контакты на месте", async ({ page }) => {
    await page.route("https://*.tile.openstreetmap.org/**", (route) => route.abort());
    await page.route("https://tile.openstreetmap.org/**", (route) => route.abort());
    await page.goto("/ru/branches/branch-ridder");
    await expect(page.getByText("ВКО, г. Риддер, ул. Ч.Уалиханова, 44").first()).toBeVisible();
    await expect(page.locator('#main a[href^="tel:"]')).toBeVisible();
    await expect(page.getByText(/Application error/)).toHaveCount(0);
  });
});
