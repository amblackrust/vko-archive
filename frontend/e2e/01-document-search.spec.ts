import { expect, test } from "@playwright/test";
import { ACCOUNTS, DEMO_CODES, StaffApi, documentId, publicApi } from "./helpers";


test.describe("Сценарий 1. Поиск документа", () => {
  test("каталог: фильтр -> карточка -> просмотр разрешённой копии", async ({ page }) => {
    const OPEN_PHOTO_DOC = await documentId(DEMO_CODES.photoFirstShift);
    await page.goto("/ru/catalog");
    await page.locator('input[name="doc_type"][value="photo"]').check();
    await page.getByRole("button", { name: "Применить" }).click();
    await expect(page).toHaveURL(/doc_type=photo/);
    await expect(page.getByText("Найдено: 8")).toBeVisible();

    await page.getByRole("link", { name: /Фотография: первая смена цеха/ }).first().click();
    await expect(page).toHaveURL(new RegExp(`/catalog/documents/${OPEN_PHOTO_DOC}`));
    await expect(page.getByRole("heading", { level: 1 })).toContainText("первая смена цеха");
    await expect(page.getByText("ДЕМО").first()).toBeVisible();
    await expect(page.getByText("Открыт для просмотра")).toBeVisible();

    const fileUrl = await page.getByRole("link", { name: "Открыть файл" }).getAttribute("href");
    expect(fileUrl).toBeTruthy();
    const file = await page.request.get(fileUrl!);
    expect(file.status()).toBe(200);
    expect(file.headers()["content-type"]).toMatch(/^image\//);
  });

  test("закрытый файл: карточка без файла, прямая ссылка и API не выдают его", async ({ page }) => {
    const RESTRICTED_DOC = await documentId(DEMO_CODES.restrictedProtocol);
    await page.goto(`/ru/catalog/documents/${RESTRICTED_DOC}`);
    await expect(page.getByText("Файлы этого документа не публикуются онлайн")).toBeVisible();
    await expect(page.getByRole("link", { name: "Открыть файл" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Скачать файл" })).toHaveCount(0);
    // Вместо заявки - только внешняя ссылка на eGov.
    await expect(page.getByRole("link", { name: "Перейти на eGov.kz" })).toHaveAttribute("href", "https://egov.kz");
    await expect(page.locator("main form")).toHaveCount(0);

    const anon = await publicApi();
    const card = await (await anon.get(`/api/catalog/documents/${RESTRICTED_DOC}`)).json();
    expect(card.files).toEqual([]);

    // id файла берём у сотрудника: анонимный запрос по прямой ссылке обязан получить 404 (не 403, без утечки).
    const staff = await StaffApi.login(ACCOUNTS.archivist);
    const files = (await (await staff.get(`/api/admin/uploads?owner_type=document&owner_id=${RESTRICTED_DOC}`)).json()) as { id: string }[];
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      expect((await anon.get(`/api/files/${f.id}`)).status()).toBe(404);
      expect((await anon.get(`/api/files/${f.id}?variant=preview`)).status()).toBe(404);
    }
    await anon.dispose();
  });

  test("умный поиск: результаты и переход в карточку", async ({ page }) => {
    await page.goto("/ru/search");
    await page.locator('main input[name="q"]').fill("приказ цех");
    await page.locator('main input[name="q"]').press("Enter");
    await expect(page).toHaveURL(/\/search\?q=/);
    await expect(page.getByText(/^Документы \(\d+\)/)).toBeVisible({ timeout: 90_000 });
    await page.locator('main a[href*="/catalog/documents/"]').first().click();
    await expect(page).toHaveURL(/\/catalog\/documents\//);
  });
});
