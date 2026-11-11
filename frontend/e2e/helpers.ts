import { request, expect, type APIRequestContext, type Page } from "@playwright/test";

export const API = process.env.E2E_API ?? "http://localhost:8201";
export const WEB = process.env.E2E_WEB ?? "http://localhost:3201";
/** Пароль демо-учёток задаёт e2e/run.sh (docs/DEMO_SCRIPT.md); в логи и отчёты не попадает. */
export const DEMO_PASSWORD = process.env.E2E_DEMO_PASSWORD ?? "";

export const ACCOUNTS = {
  superadmin: "superadmin@demo.kz",
  siteadmin: "siteadmin@demo.kz",
  editor: "editor@demo.kz",
  archivist: "archivist@demo.kz",
  branchRidder: "branch.ridder@demo.kz",
  moderator: "moderator@demo.kz",
  analyst: "analyst@demo.kz",
} as const;

const sessions = new Map<string, StaffApi>();

/** Сессия сотрудника через API (cookie + CSRF-заголовок), как её использует админка. */
export class StaffApi {
  private constructor(private readonly ctx: APIRequestContext, private readonly csrf: string) {}

  /** Сессия кэшируется на процесс: вход сотрудника ограничен 20 запросами в минуту с одного IP. */
  static async login(email: string): Promise<StaffApi> {
    const cached = sessions.get(email);
    if (cached) return cached;
    const ctx = await request.newContext({ baseURL: API, extraHTTPHeaders: { Origin: WEB } });
    const response = await ctx.post("/api/admin/auth/login", { data: { email, password: DEMO_PASSWORD } });
    expect(response.status(), `login ${email}`).toBe(200);
    const me = (await response.json()) as { csrf_token: string };
    const api = new StaffApi(ctx, me.csrf_token);
    sessions.set(email, api);
    return api;
  }

  private headers() {
    return { "X-CSRF-Token": this.csrf, Origin: WEB };
  }
  get(url: string) {
    return this.ctx.get(url, { headers: this.headers() });
  }
  post(url: string, data: unknown) {
    return this.ctx.post(url, { data, headers: this.headers() });
  }
  patch(url: string, data: unknown) {
    return this.ctx.patch(url, { data, headers: this.headers() });
  }
  put(url: string, data: unknown) {
    return this.ctx.put(url, { data, headers: this.headers() });
  }
  delete(url: string) {
    return this.ctx.delete(url, { headers: this.headers() });
  }
}

/** Публичный API без сессии. */
export async function publicApi(): Promise<APIRequestContext> {
  return request.newContext({ baseURL: API });
}

export async function loginInBrowser(page: Page, email: string) {
  await page.goto("/ru/admin");
  await page.getByLabel(/Электронная почта/).fill(email);
  await page.getByLabel(/Пароль/).fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Войти" }).click();
  await expect(page.getByRole("button", { name: "Выйти" })).toBeVisible({ timeout: 15_000 });
}

/** Шифры демо-документов; UUID при каждом seed новые, поэтому id всегда ищем по шифру. */
export const DEMO_CODES = {
  order31: "ДЕМО Ф.Д-1 Оп.1 Д.1 №1", // Приказ № 31 о пуске цеха обогащения, открыт
  restrictedProtocol: "ДЕМО Ф.Д-1 Оп.1 Д.3 №1", // Протокол № 5, file_access=restricted
  photoMounting: "ДЕМО Ф.Д-1 Оп.2 Д.1 №1", // Фотография: монтаж оборудования в цехе
  photoFirstShift: "ДЕМО Ф.Д-1 Оп.2 Д.1 №3", // Фотография: первая смена цеха
} as const;

const documentIds = new Map<string, string>();

export async function documentId(code: string): Promise<string> {
  const cached = documentIds.get(code);
  if (cached) return cached;
  const api = await publicApi();
  let found: { id: string; archive_code: string } | undefined;
  for (let page = 1; page <= 10 && !found; page++) {
    const list = await (await api.get(`/api/catalog/documents?page=${page}`)).json();
    found = (list.items as { id: string; archive_code: string }[]).find((d) => d.archive_code === code);
    if (page >= list.pages) break;
  }
  await api.dispose();
  if (!found) throw new Error(`демо-документ ${code} не найден: выполнен ли seed?`);
  documentIds.set(code, found.id);
  return found.id;
}

export function uniqueSlug(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;
}
