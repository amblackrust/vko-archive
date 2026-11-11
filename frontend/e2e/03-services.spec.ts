import { expect, test } from "@playwright/test";

test.describe("Сценарий 3. Информация об услугах", () => {
  test("госуслуга: правила, внешний переход на eGov, форм нет", async ({ page }) => {
    await page.goto("/ru/services/state");
    await expect(page.getByText("На этом сайте заявления не принимаются")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Нормативная основа" })).toBeVisible();
    const egov = page.getByRole("link", { name: /Перейти на eGov\.kz/ });
    await expect(egov).toHaveAttribute("href", "https://egov.kz");
    await expect(egov).toHaveAttribute("target", "_blank");
    await expect(egov).toHaveAttribute("rel", /noopener/);
    await expect(page.getByRole("link", { name: "Перейти на e-Otinish" })).toHaveAttribute("href", "https://eotinish.kz");
    await expect(page.locator("main form")).toHaveCount(0);
    await expect(page.locator("main input, main textarea")).toHaveCount(0);
  });

  test("прейскурант: справочно, оплаты и формы нет", async ({ page }) => {
    await page.goto("/ru/services/paid");
    await expect(page.getByText("Оформление и оплата услуг на сайте не производятся")).toBeVisible();
    await expect(page.getByText("Прейскурант").first()).toBeVisible();
    await expect(page.locator("main form")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /оплатить|заказать|отправить заявку/i })).toHaveCount(0);
  });

  test("со страницы услуг можно найти правила через умный поиск", async ({ page }) => {
    await page.goto("/ru/search?q=" + encodeURIComponent("как получить архивную справку"));
    await expect(page.locator("main form")).toHaveCount(1); // единственная форма - строка поиска
  });
});
