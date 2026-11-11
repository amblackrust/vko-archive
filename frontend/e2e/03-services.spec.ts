import { expect, test } from "@playwright/test";

test.describe("Сценарий 3. Информация об услугах", () => {
  test("госуслуга: условия, внешний переход на eGov, форм нет", async ({ page }) => {
    await page.goto("/ru/services/state");
    await expect(page.getByText("Заявления здесь не принимаются", { exact: false })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Нормативная основа" })).toBeVisible();
    const egov = page.locator('main a[href^="https://egov.kz"]').first();
    await expect(egov).toHaveAttribute("target", "_blank");
    await expect(egov).toHaveAttribute("rel", /noopener/);
    await expect(page.locator('main a[href^="https://eotinish.kz"]').first()).toBeVisible();
    await expect(page.locator("main form")).toHaveCount(0);
    await expect(page.locator("main input, main textarea")).toHaveCount(0);
  });

  test("платные услуги: справочно, оплаты и формы нет", async ({ page }) => {
    await page.goto("/ru/services/paid");
    await expect(page.getByText("Оформление и оплата услуг на сайте не производятся", { exact: false })).toBeVisible();
    await expect(page.locator("main form")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /оплатить|заказать|отправить заявку/i })).toHaveCount(0);
  });

  test("навигатор: цель и организация ведут к фонду и следующим шагам", async ({ page }) => {
    await page.goto("/ru/navigator");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Где искать документы");
    // Навигатор только подсказывает: полей для заявления и отправки данных на сайт нет.
    await expect(page.getByRole("button", { name: /отправить заявку|подать заявление|оплатить/i })).toHaveCount(0);
  });

  test("поиск по сайту находит порядок получения справки", async ({ page }) => {
    await page.goto("/ru/search?q=" + encodeURIComponent("как получить архивную справку"));
    await expect(page.locator("main form")).toHaveCount(1); // единственная форма — строка поиска
  });
});
