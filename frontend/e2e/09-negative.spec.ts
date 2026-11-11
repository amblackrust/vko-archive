import { expect, test } from "@playwright/test";
import { ACCOUNTS, API, DEMO_CODES, DEMO_PASSWORD, StaffApi, WEB, documentId, publicApi } from "./helpers";

test.describe("Сценарий 9. Негативные случаи", () => {
  test("пустая выдача: понятное сообщение", async ({ page }) => {
    await page.goto("/ru/catalog?q=" + encodeURIComponent("zzzzqqqq несуществующее"));
    await expect(page.getByText("Ничего не найдено").first()).toBeVisible();
    // Умный поиск: «завода» в демо-данных нет, ИИ честно говорит, что ничего не нашёл.
    await page.goto("/ru/search?q=" + encodeURIComponent("завод"));
    await expect(page.getByText("Ничего не найдено").first()).toBeVisible({ timeout: 90_000 });
    await expect(page.getByText("Источники")).toHaveCount(0);
    await expect(page.locator('main a[href*="/catalog/documents/"]')).toHaveCount(0);
  });

  test("несуществующий документ и файл: 404 без утечек", async ({ page }) => {
    const missing = "00000000-0000-4000-8000-000000000000";
    await page.goto(`/ru/catalog/documents/${missing}`);
    await expect(page.getByText("Страница не найдена")).toBeVisible();
    const api = await publicApi();
    expect((await api.get(`/api/files/${missing}`)).status()).toBe(404);
    expect((await api.get(`/api/catalog/documents/${missing}`)).status()).toBe(404);
    await api.dispose();
  });

  test("закрытые данные недоступны без входа: админ-API отвечает 401", async () => {
    const api = await publicApi();
    for (const url of ["/api/admin/auth/me", "/api/admin/branches", "/api/admin/catalog/document", "/api/admin/audit"]) {
      expect((await api.get(url)).status(), url).toBe(401);
    }
    await api.dispose();
  });

  test("неверный пароль: единое сообщение, затем блокировка учётки", async ({ page }) => {
    const anon = await publicApi();
    const bad = async () =>
      anon.post("/api/admin/auth/login", { data: { email: "lockout@demo.kz", password: "Wrong-Pass-000!" }, headers: { Origin: WEB } });
    // Неизвестный e-mail и неверный пароль неотличимы (нет перечисления учёток).
    const unknown = await anon.post("/api/admin/auth/login", { data: { email: "nobody@demo.kz", password: "Wrong-Pass-000!" } });
    const wrong = await bad();
    expect(unknown.status()).toBe(401);
    expect(wrong.status()).toBe(401);
    expect(await unknown.json()).toEqual(await wrong.json());

    // Форма входа показывает сообщение об ошибке и не раскрывает пароль.
    await page.goto("/ru/admin");
    await page.getByLabel(/Электронная почта/).fill("lockout@demo.kz");
    await page.getByLabel(/Пароль/).fill("Wrong-Pass-000!");
    await page.getByRole("button", { name: "Войти" }).click();
    await expect(page.getByRole("alert").filter({ hasText: /\S/ }).first()).toBeVisible();
    await expect(page.getByLabel(/Пароль/)).toHaveAttribute("type", "password");

    // До порога (5 неудач) учётка принимает верный пароль; после - блокируется (ответ тот же 401, без подсказок).
    for (let i = 0; i < 4; i++) expect((await bad()).status()).toBe(401);
    const correct = await anon.post("/api/admin/auth/login", { data: { email: "lockout@demo.kz", password: DEMO_PASSWORD } });
    expect(correct.status(), "верный пароль заблокированной учётки").toBe(401);
    await anon.dispose();
  });

  test("Ollama выключена: поиск остаётся рабочим, сообщение без технических деталей", async ({ page }) => {
    await page.route("**/api/ai/**", (route) => route.fulfill({ status: 503, json: { detail: "ai_unavailable" } }));
    await page.goto("/ru/search?q=" + encodeURIComponent("приказ цех"));
    await expect(page.getByText(/^Документы \(\d+\)/)).toBeVisible({ timeout: 90_000 });
    await expect(page.getByText("Не удалось получить ответ")).toBeVisible();
    await expect(page.getByText(/Traceback|ECONNREFUSED|localhost:11434|Internal Server Error/)).toHaveCount(0);
    // На карточке документа вопросы ИИ отключены, сама карточка работает.
    await page.goto(`/ru/catalog/documents/${await documentId(DEMO_CODES.order31)}`);
    await expect(page.getByRole("button", { name: "Когда выдан документ?" })).toBeDisabled();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Приказ № 31");
  });

  test("сервер ошибся: публичные страницы не показывают стек и пути", async ({ page }) => {
    await page.route(`${API}/api/branches**`, (route) => route.fulfill({ status: 500, body: "boom" }));
    await page.goto("/ru/branches");
    await expect(page.getByText(/Traceback|boom|at Object/)).toHaveCount(0);
  });

  test("роль без прав получает 403, а не данные", async () => {
    const analyst = await StaffApi.login(ACCOUNTS.analyst);
    const r = await analyst.post("/api/admin/content/news", { slug: "e2e-forbidden", title: { ru: "x" } });
    expect(r.status()).toBe(403);
    const editor = await StaffApi.login(ACCOUNTS.editor);
    expect((await editor.get("/api/admin/audit")).status()).toBe(403);
  });
});
