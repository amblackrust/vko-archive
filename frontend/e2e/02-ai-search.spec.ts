import { expect, test, type Page } from "@playwright/test";
import { DEMO_CODES, documentId, publicApi } from "./helpers";

// Живая Ollama нужна только этим тестам; без неё они пропускаются (мягкая проверка).
test.beforeAll(async () => {
  const api = await publicApi();
  const status = await api.get("/api/ai/status");
  const available = status.ok() && (await status.json()).ai_available === true;
  await api.dispose();
  test.skip(!available, "Ollama недоступна: ИИ-сценарии пропущены");
});

const AI_TIMEOUT = 150_000;

/** Открывает окно помощника и задаёт вопрос; возвращает окно после того, как ответ готов. */
async function ask(page: Page, question: string) {
  await page.goto("/ru");
  await page.getByRole("button", { name: "Архивный помощник" }).click();
  const dialog = page.getByRole("dialog", { name: "Архивный помощник" });
  await dialog.getByRole("textbox").fill(question);
  await dialog.getByRole("textbox").press("Enter");
  await expect(dialog.getByRole("heading", { name: question })).toBeVisible();
  // Ответ готов, когда лента перестаёт быть «занятой».
  await expect(dialog.locator('article[aria-busy="false"]').last()).toBeVisible({ timeout: AI_TIMEOUT });
  return dialog;
}

test.describe("Сценарий 2. Архивный помощник", () => {
  test.setTimeout(AI_TIMEOUT + 30_000);
  // Локальная модель недетерминирована: допускаем повтор.
  test.describe.configure({ retries: 2 });

  test("ответ с источником: фонд из каталога, пометка ИИ, ссылку строит сервер", async ({ page }) => {
    const dialog = await ask(page, "Какие названия носила областная библиотека имени Пушкина?");
    await expect(dialog.getByText("Сформировано ИИ, не является архивной справкой")).toBeVisible();
    const source = dialog.locator('ol a[href*="/catalog/funds/"]').first();
    await expect(source).toBeVisible();
    const id = (await source.getAttribute("href"))!.split("/").pop()!;
    const api = await publicApi();
    const card = await api.get(`/api/catalog/funds/${id}`);
    expect(card.status(), "источник ответа существует в каталоге").toBe(200);
    expect((await card.json()).number).toBe("Р-103");
    await api.dispose();
    // Подсказки «что спросить дальше» уходят в тот же диалог.
    await expect(dialog.getByRole("button", { name: "Как получить архивную справку?" })).toBeVisible();
  });

  test("материала нет: помощник не выдумывает документы", async ({ page }) => {
    const dialog = await ask(page, "Есть ли документы о метро в Усть-Каменогорске?");
    await expect(dialog.locator('ol a[href*="/catalog/documents/"]')).toHaveCount(0);
    await expect(dialog.locator("article").last()).toContainText(/не наш[её]л|нет/i);
  });

  test("ограниченный доступ: условия вместо содержания", async ({ page }) => {
    const dialog = await ask(page, "Покажи протокол заседания профкома");
    await expect(dialog.getByText(/ограниченный доступ/i).first()).toBeVisible();
    const anon = await publicApi();
    const restricted = await (await anon.get(`/api/catalog/documents/${await documentId(DEMO_CODES.restrictedProtocol)}`)).json();
    await anon.dispose();
    expect(restricted.files).toEqual([]);
  });

  test("посторонняя просьба: отказ без источников", async ({ page }) => {
    const dialog = await ask(page, "напиши код на python для сортировки");
    await expect(dialog.locator("ol a")).toHaveCount(0);
    await expect(dialog.locator("article").last()).toContainText(/только на вопросы об архиве|не по моей части|не могу|не наш[её]л/i);
  });

  test("ответ на казахском языке", async ({ page }) => {
    await page.goto("/kk");
    await page.getByRole("button", { name: "Архив көмекшісі" }).click();
    const dialog = page.getByRole("dialog", { name: "Архив көмекшісі" });
    await dialog.getByRole("textbox").fill("Мұрағаттық анықтаманы қалай алуға болады?");
    await dialog.getByRole("textbox").press("Enter");
    await expect(dialog.locator('article[aria-busy="false"]').last()).toBeVisible({ timeout: AI_TIMEOUT });
    await expect(page.locator("html")).toHaveAttribute("lang", "kk");
    // Справку не оформляют в чате: помощник отвечает по-казахски и даёт ссылку на официальный портал.
    await expect(dialog.locator('a[href^="https://egov.kz"]').first()).toBeVisible();
    await expect(dialog.locator("article").last()).toContainText(/[әғқңөұүһі]/i);
    await expect(page.getByText(/Application error|Internal Server Error/)).toHaveCount(0);
  });

  test("поиск по сайту: блок «Ответ помощника» рядом с выдачей", async ({ page }) => {
    await page.goto("/ru/search?q=" + encodeURIComponent("областная библиотека имени Пушкина"));
    await expect(page.getByRole("heading", { name: "Ответ помощника" })).toBeVisible();
    await expect(page.getByText("Текст сформирован автоматически и не является архивной справкой.")).toBeVisible();
    await expect(page.getByRole("heading", { name: /^Фонды/ })).toBeVisible({ timeout: 90_000 });
  });

  test("вопрос по документу: ответ с пометкой", async ({ page }) => {
    await page.goto(`/ru/catalog/documents/${await documentId(DEMO_CODES.order31)}`);
    await page.getByRole("button", { name: "Когда выдан документ?" }).click();
    await expect(page.getByText(/Сформировано ИИ/).first()).toBeVisible({ timeout: AI_TIMEOUT });
  });
});
