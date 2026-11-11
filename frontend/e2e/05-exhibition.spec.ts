import { expect, test } from "@playwright/test";
import { publicApi } from "./helpers";

test.describe("Сценарий 5. Выставка", () => {
  test("просмотр, зум экспоната, подпись, переход к источнику", async ({ page }) => {
    await page.goto("/ru/exhibitions");
    await page.getByRole("link", { name: /Промышленное развитие Восточного Казахстана/ }).first().click();
    await expect(page).toHaveURL(/\/exhibitions\/exhibition-industry$/);
    await expect(page.getByText("ДЕМО").first()).toBeVisible();

    await page.getByRole("link", { name: "Начать просмотр" }).click();
    await expect(page).toHaveURL(/\/exhibition-industry\/1$/);
    await page.goto("/ru/exhibitions/exhibition-industry/6");
    await expect(page.getByText("Экспонат 6 из 8")).toBeVisible();
    await expect(page.getByText("Подпись")).toBeVisible();
    await expect(page.getByText("Бригада монтажников у стальной рамы")).toBeVisible();

    const zoom = page.getByRole("status").filter({ hasText: "%" });
    await expect(zoom).toHaveText("100%");
    await page.getByRole("button", { name: "Увеличить" }).click();
    await expect(zoom).not.toHaveText("100%");
    await page.getByRole("button", { name: "Сбросить масштаб" }).click();
    await expect(zoom).toHaveText("100%");

    await page.getByRole("link", { name: "Следующий" }).click();
    await expect(page.getByText("Экспонат 7 из 8")).toBeVisible();
    await page.getByRole("link", { name: "Предыдущий" }).click();
    await expect(page.getByText("Экспонат 6 из 8")).toBeVisible();

    await page.getByRole("link", { name: "К документу в каталоге" }).click();
    // Ссылка ведёт на документ, на который указывает сам экспонат (id берём из API выставки).
    const api = await publicApi();
    const exhibition = await (await api.get("/api/exhibitions/exhibition-industry")).json();
    const href = (exhibition.exhibits as { position: number; document_href: string }[]).find((e) => e.position === 6)!.document_href;
    await api.dispose();
    await expect(page).toHaveURL(new RegExp(`/ru${href}$`));
    await expect(page.getByText("Шифр: ДЕМО Ф.Д-1 Оп.2 Д.1 №1")).toBeVisible();
  });
});
