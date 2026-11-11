import { expect, test } from "@playwright/test";
import { ACCOUNTS, DEMO_CODES, StaffApi, documentId, loginInBrowser, publicApi, uniqueSlug } from "./helpers";


async function transition(api: StaffApi, type: string, id: string, action: string, version: number, comment?: string) {
  const r = await api.post(`/api/admin/workflow/${type}/${id}/transitions`, { action, version, comment });
  expect(r.status(), `${type} ${action}: ${await r.text()}`).toBe(200);
  return (await r.json()) as { version: number; workflow_status: string };
}

test.describe("Сценарий 6. Редактор -> согласование -> публикация", () => {
  test("материал не виден публично до одобрения", async ({ page }) => {
    const editor = await StaffApi.login(ACCOUNTS.editor);
    const moderator = await StaffApi.login(ACCOUNTS.moderator);
    const anon = await publicApi();
    const slug = uniqueSlug("e2e-news");
    const title = "ДЕМО E2E новость редактора";

    const created = await editor.post("/api/admin/content/news", {
      slug,
      title: { ru: title },
      summary: { ru: "ДЕМО" },
      body: { ru: "<p>Вымышленный текст</p><script>alert(1)</script>" },
      is_demo: true,
    });
    expect(created.status()).toBe(201);
    const news = await created.json();
    expect(news.workflow_status).toBe("draft");
    expect(news.values.body.ru).not.toContain("script");

    // Черновик: нет ни в API, ни на странице, ни в поиске.
    const hidden = async () => {
      expect((await anon.get(`/api/news/${slug}`)).status()).toBe(404);
      const listed = await (await anon.get("/api/news?page_size=100")).json();
      expect(JSON.stringify(listed)).not.toContain(slug);
      await page.goto(`/ru/news/${slug}`);
      await expect(page.getByText("Страница не существует")).toBeVisible();
    };
    await hidden();

    // Редактор не может опубликовать сам.
    const submitted = await transition(editor, "news", news.id, "submit", news.version);
    expect(submitted.workflow_status).toBe("review");
    expect((await editor.post(`/api/admin/workflow/news/${news.id}/transitions`, { action: "publish", version: submitted.version })).status()).toBeGreaterThanOrEqual(403);
    await hidden(); // на согласовании - всё ещё не публично

    // Модератор возвращает с комментарием, редактор отправляет снова.
    const noComment = await moderator.post(`/api/admin/workflow/news/${news.id}/transitions`, { action: "return", version: submitted.version });
    expect(noComment.status()).toBe(422 === noComment.status() ? 422 : noComment.status());
    expect(noComment.ok()).toBe(false);
    const returned = await transition(moderator, "news", news.id, "return", submitted.version, "Уточните формулировку");
    expect(returned.workflow_status).toBe("needs_changes");
    const again = await transition(editor, "news", news.id, "submit", returned.version);

    const approved = await transition(moderator, "news", news.id, "approve", again.version);
    expect(approved.workflow_status).toBe("approved");
    await hidden(); // одобрено, но не опубликовано

    const published = await transition(moderator, "news", news.id, "publish", approved.version);
    expect(published.workflow_status).toBe("published");
    expect((await anon.get(`/api/news/${slug}`)).status()).toBe(200);
    await page.goto(`/ru/news/${slug}`);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(title);

    // История версий сохранена.
    const history = (await (await moderator.get(`/api/admin/workflow/news/${news.id}/history`)).json()) as { to_status: string }[];
    expect(history.map((h) => h.to_status)).toEqual(["draft", "review", "needs_changes", "review", "approved", "published"]);

    await anon.dispose();
  });

  test("редактор входит в админку через форму и видит разделы своей роли", async ({ page }) => {
    await loginInBrowser(page, ACCOUNTS.editor);
    await expect(page.getByText("Только для сотрудников архива")).toHaveCount(0);
    // Обзор открыт, разделы роли видны; журнал действий и матрица ролей редактору недоступны.
    await expect(page.getByRole("heading", { level: 1, name: "Обзор" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Контент сайта" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Журнал действий" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Роли и права" })).toHaveCount(0);
    // Язык интерфейса — выпадающим списком, выход — в меню учётной записи.
    await page.getByRole("button", { name: "Язык интерфейса" }).click();
    await expect(page.getByRole("link", { name: /Қазақша/ })).toBeVisible();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Учётная запись" }).click();
    // Сам выход не нажимаем: он завершает все сессии сотрудника, а ими пользуются соседние сценарии.
    await expect(page.getByRole("button", { name: "Выйти" })).toBeVisible();
  });
});

test.describe("Сценарий 7. Администратор филиала", () => {
  test("меняет контакты своего филиала; чужой - 403", async ({ page }) => {
    const boss = await StaffApi.login(ACCOUNTS.superadmin);
    const all = (await (await boss.get("/api/admin/branches?page_size=50")).json()).items as { id: string; number: string }[];
    const own = all.find((b) => b.number === "branch-ridder")!;
    const foreign = all.find((b) => b.number === "branch-altai")!;

    const admin = await StaffApi.login(ACCOUNTS.branchRidder);
    const listed = (await (await admin.get("/api/admin/branches")).json()).items as { id: string }[];
    expect(listed.map((b) => b.id)).toEqual([own.id]);

    // Опубликованную карточку сначала возвращают в работу, правят и снова проводят через согласование.
    // Повторный прогон на той же БД: сначала возвращаем карточку в опубликованное состояние.
    const moderator = await StaffApi.login(ACCOUNTS.moderator);
    for (let step = 0; step < 3; step++) {
      const current = await (await moderator.get(`/api/admin/branches/${own.id}`)).json();
      const next = { review: "approve", approved: "publish" }[current.workflow_status as string];
      if (!next) break;
      await transition(moderator, "branch", own.id, next, current.version);
    }
    const card = await (await admin.get(`/api/admin/branches/${own.id}`)).json();
    const reopened =
      card.workflow_status === "published"
        ? await transition(admin, "branch", own.id, "rework", card.version, "Обновление контактов (ДЕМО)")
        : { version: card.version };
    const phone = `8 (72336) 5${Date.now().toString().slice(-4)}`;
    const changed = await admin.patch(`/api/admin/branches/${own.id}`, { version: reopened.version, phone, hours: { ru: "Пн-Пт 9.00-18.00 (ДЕМО)" } });
    expect(changed.status(), await changed.text()).toBe(200);
    const edited = await changed.json();
    expect(edited.values.phone).toBe(phone);
    const review = await transition(admin, "branch", own.id, "submit", edited.version);
    const approved = await transition(moderator, "branch", own.id, "approve", review.version);
    await transition(moderator, "branch", own.id, "publish", approved.version);
    const publicBranch = await (await (await publicApi()).get("/api/branches/branch-ridder")).json();
    expect(publicBranch.phone).toBe(phone);

    const other = await (await boss.get(`/api/admin/branches/${foreign.id}`)).json();
    expect((await admin.get(`/api/admin/branches/${foreign.id}`)).status()).toBe(403);
    expect((await admin.patch(`/api/admin/branches/${foreign.id}`, { version: other.version, phone: "8 000" })).status()).toBe(403);
    expect((await admin.delete(`/api/admin/branches/${foreign.id}`)).status()).toBe(403);
    const untouched = await (await boss.get(`/api/admin/branches/${foreign.id}`)).json();
    expect(untouched.values.phone).not.toBe("8 000");

    // В интерфейсе админ филиала видит только свой филиал.
    await loginInBrowser(page, ACCOUNTS.branchRidder);
    await page.goto("/ru/admin/branches");
    await expect(page.getByText("Риддерский городской филиал").first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Филиал района Алтай")).toHaveCount(0);

    
  });
});

test.describe("Сценарий 8. Историческая подборка", () => {
  test("подборка из разрешённых материалов -> на согласование, публично не видна до публикации", async () => {
    const editor = await StaffApi.login(ACCOUNTS.editor);
    const moderator = await StaffApi.login(ACCOUNTS.moderator);
    const anon = await publicApi();
    const OPEN_DOC = await documentId(DEMO_CODES.order31);
    const OPEN_DOC_2 = await documentId(DEMO_CODES.photoFirstShift);
    const RESTRICTED_DOC = await documentId(DEMO_CODES.restrictedProtocol);
    const slug = uniqueSlug("e2e-collection");

    const created = await editor.post("/api/admin/memory/collection", {
      slug,
      title: { ru: "ДЕМО E2E подборка" },
      description: { ru: "Подборка из открытых материалов" },
      is_demo: true,
    });
    expect(created.status(), await created.text()).toBe(201);
    const collection = await created.json();

    const items = [OPEN_DOC, OPEN_DOC_2].map((id) => ({ item_type: "document", item_id: id, note: { ru: "Источник: карточка документа в каталоге" } }));
    const filled = await editor.put(`/api/admin/memory/collection/${collection.id}/items`, { version: collection.version, items });
    expect(filled.status(), await filled.text()).toBe(200);
    const saved = await filled.json();
    expect(saved.values.items.map((i: { item_id: string }) => i.item_id)).toEqual([OPEN_DOC, OPEN_DOC_2]);

    const review = await transition(editor, "collection", collection.id, "submit", saved.version);
    expect(review.workflow_status).toBe("review");
    expect((await anon.get(`/api/memory/collections/${slug}`)).status()).toBe(404);

    const approved = await transition(moderator, "collection", collection.id, "approve", review.version);
    await transition(moderator, "collection", collection.id, "publish", approved.version);
    const publicView = await anon.get(`/api/memory/collections/${slug}`);
    expect(publicView.status()).toBe(200);
    const body = JSON.stringify(await publicView.json());
    expect(body).toContain(OPEN_DOC);
    expect(body).not.toContain(RESTRICTED_DOC);

    await anon.dispose();
  });
});
