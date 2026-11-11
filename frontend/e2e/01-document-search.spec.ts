import { expect, test } from "@playwright/test";
import { ACCOUNTS, DEMO_CODES, StaffApi, documentId, publicApi } from "./helpers";

test.describe("Сценарий 1. Поиск документа", () => {
  test("каталог: фильтр -> карточка -> просмотр разрешённой копии", async ({ page }) => {
    const OPEN_PHOTO_DOC = await documentId(DEMO_CODES.photoFirstShift);
    await page.goto("/ru/catalog");
    await page.locator('input[name="doc_type"][value="photo"]').check();
    await page.getByRole("button", { name: "Применить" }).click();
    await expect(page).toHaveURL(/doc_type=photo/);
    await expect(page.getByRole("heading", { name: /Найдено: \d+/ })).toBeVisible();

    // Строка поиска каталога сохраняет выбранный фильтр.
    await page.locator("#catalog-q").fill("первая смена цеха");
    await page.locator("#catalog-q").press("Enter");
    await expect(page).toHaveURL(/doc_type=photo/);
    await page.getByRole("link", { name: /Фотография: первая смена цеха/ }).first().click();
    await expect(page).toHaveURL(new RegExp(`/catalog/documents/${OPEN_PHOTO_DOC}`));
    await expect(page.getByRole("heading", { level: 1 })).toContainText("первая смена цеха");
    await expect(page.getByText("Открытый доступ").first()).toBeVisible();

    const fileUrl = await page.getByRole("link", { name: "Открыть файл" }).getAttribute("href");
    expect(fileUrl).toBeTruthy();
    const file = await page.request.get(fileUrl!);
    expect(file.status()).toBe(200);
    expect(file.headers()["content-type"]).toMatch(/^image\//);
  });

  test("каталог: плитка и список показывают одни и те же записи", async ({ page }) => {
    await page.goto("/ru/catalog?q=" + encodeURIComponent("приказ"));
    const inGrid = await page.locator('main h3 a[href*="/catalog/documents/"]').count();
    expect(inGrid).toBeGreaterThan(0);
    await page.getByRole("link", { name: "Список" }).click();
    await expect(page).toHaveURL(/view=list/);
    await expect(page.locator('main h3 a[href*="/catalog/documents/"]')).toHaveCount(inGrid);
  });

  test("закрытый файл: карточка без файла, прямая ссылка и API не выдают его", async ({ page }) => {
    const RESTRICTED_DOC = await documentId(DEMO_CODES.restrictedProtocol);
    await page.goto(`/ru/catalog/documents/${RESTRICTED_DOC}`);
    await expect(page.getByText("Ограниченный доступ").first()).toBeVisible();
    await expect(page.getByText("Файлы этого документа не публикуются онлайн")).toBeVisible();
    await expect(page.getByRole("link", { name: "Открыть файл" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Скачать файл" })).toHaveCount(0);
    // Заявок на сайте нет: в карточке нет ни одной формы подачи.
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

  test("поиск по сайту: результаты и переход в карточку", async ({ page }) => {
    await page.goto("/ru/search");
    await page.locator("#search-q").fill("приказ цех");
    await page.locator("#search-q").press("Enter");
    await expect(page).toHaveURL(/\/search\?q=/);
    await expect(page.getByRole("heading", { name: /^Документы/ })).toBeVisible({ timeout: 90_000 });
    await page.locator('main a[href*="/catalog/documents/"]').first().click();
    await expect(page).toHaveURL(/\/catalog\/documents\//);
  });

  test("фонд: прежние названия, сведения и вопрос помощнику со страницы", async ({ page }) => {
    const api = await publicApi();
    const funds = await (await api.get("/api/catalog/funds?q=" + encodeURIComponent("библиотека Пушкина") + "&per_page=5")).json();
    await api.dispose();
    const fund = (funds.items as { id: string; number: string }[]).find((item) => item.number === "Р-103");
    expect(fund, "фонд Р-103 из перечня архива").toBeTruthy();
    await page.goto(`/ru/catalog/funds/${fund!.id}`);
    await expect(page.getByText("Фонд № Р-103").first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "История названий" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Как получить справку" })).toHaveAttribute("href", /\/services\/state$/);
    // Кнопка открывает окно помощника с готовым вопросом об этом фонде.
    await page.getByRole("button", { name: "Спросить помощника о фонде" }).click();
    await expect(page.getByRole("dialog", { name: "Архивный помощник" })).toBeVisible();
    await expect(page.getByRole("dialog").getByRole("heading", { name: /Расскажи о фонде № Р-103/ })).toBeVisible({ timeout: 15_000 });
  });
});
