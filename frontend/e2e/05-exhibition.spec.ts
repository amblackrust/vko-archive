import { expect, test } from "@playwright/test";
import { publicApi } from "./helpers";

test.describe("Сценарий 5. Выставка", () => {
  test("просмотр, зум экспоната, подпись, переход к источнику", async ({ page }) => {
    const api = await publicApi();
    const exhibition = await (await api.get("/api/exhibitions/exhibition-industry?lang=ru")).json();
    await api.dispose();
    const exhibits = exhibition.exhibits as { position: number; title: string; source: string; archive_code: string; document_href: string }[];
    const total = exhibits.length;
    const sixth = exhibits.find((e) => e.position === 6)!;

    await page.goto("/ru/exhibitions");
    await page.getByRole("link", { name: exhibition.title }).first().click();
    await expect(page).toHaveURL(/\/exhibitions\/exhibition-industry$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(exhibition.title);

    await page.getByRole("link", { name: "Начать просмотр" }).click();
    await expect(page).toHaveURL(/\/exhibition-industry\/1$/);
    await page.goto("/ru/exhibitions/exhibition-industry/6");
    await expect(page.getByText(`Экспонат 6 из ${total}`)).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(sixth.title);
    // Происхождение изображения названо рядом с экспонатом: автор и лицензия.
    await expect(page.getByText(sixth.source).first()).toBeVisible();

    const zoom = page.getByRole("status").filter({ hasText: "%" });
    await expect(zoom).toHaveText("100%");
    await page.getByRole("button", { name: "Увеличить" }).click();
    await expect(zoom).not.toHaveText("100%");
    await page.getByRole("button", { name: "Сбросить масштаб" }).click();
    await expect(zoom).toHaveText("100%");

    await page.getByRole("link", { name: "Следующий" }).click();
    await expect(page.getByText(`Экспонат 7 из ${total}`)).toBeVisible();
    await page.getByRole("link", { name: "Предыдущий" }).click();
    await expect(page.getByText(`Экспонат 6 из ${total}`)).toBeVisible();

    // Ссылка ведёт на документ, на который указывает сам экспонат.
    await page.getByRole("link", { name: "К документу в каталоге" }).click();
    await expect(page).toHaveURL(new RegExp(`/ru${sixth.document_href}$`));
    await expect(page.getByText(sixth.archive_code).first()).toBeVisible();
  });
});
