# Архитектурные решения

Формат: дата — решение — обоснование. Новые записи добавлять в конец.

## 2026-11-10 — B01: фундамент backend

1. **Поиск в PostgreSQL, без Elasticsearch/OpenSearch.** Полнотекст `tsvector` (конфиг `simple`,
   у Postgres нет казахского стеммера) + `pg_trgm` для опечаток + `pgvector` для семантики,
   слияние RRF. Для прототипа один Postgres проще развернуть и сопровождать; поиск позже
   выносится в OpenSearch за интерфейсом `SearchBackend`.

2. **Единая таблица индекса `search_entries`.** Строка = (object_type, object_id, lang, chunk_no):
   title, body, `tsv` (tsvector), `embedding` (vector), embedding_model. Один индекс на все типы
   (документы, фонды, страницы, филиалы, выставки, коллекции, новости) упрощает единый поиск
   и RAG; `chunk_no` — для длинных текстов (OCR открытых файлов). В индекс пишется только
   разрешённое (description_status = public, опубликованный контент). GIN по `tsv`,
   GIN trigram по `title`, HNSW (cosine) по `embedding`.

3. **Размерность эмбеддингов = 1024.** Получена фактическим запросом к локальной Ollama
   `POST /api/embed {"model": "bge-m3", "input": "тест"}` → длина вектора 1024
   (совпадает с `embedding_length` в `GET /api/tags`). Зафиксирована константой
   `EMBEDDING_DIM` в `backend/app/models/base.py` и в миграции `0001` (`vector(1024)`).
   `/api/health` при каждой проверке сверяет фактическую размерность с константой.
   Смена модели эмбеддингов = новая миграция колонки + переиндексация.

4. **Перечисления — VARCHAR + CHECK, не нативные PG enum.** Добавление значения — простая
   замена CHECK-ограничения в новой миграции. `doc_type`, `period`, `language`, `theme`
   оставлены строками без CHECK: справочники будут расширяться из админки/импорта.

5. **Иерархия каталога через FK с ON DELETE RESTRICT** (фонд → опись → дело → документ):
   удалить родителя с потомками нельзя. `documents.case_id` допускает NULL, чтобы черновик
   или импортированная запись могли существовать до привязки к делу.
   `documents.archive_code` (шифр) — отдельное уникальное поле; стабильный внутренний id — uuid.

6. **Общие поля контента** (`ContentMixin`): id uuid, slug (уникальный, nullable), created_at/
   updated_at, created_by, workflow_status (draft/review/needs_changes/approved/published/
   archived), version, translation_status (JSONB по языкам). Переводимые поля — JSONB
   `{"kk","ru","en"}`.

7. **Полиморфные связи без FK**: `digital_files.owner_type/owner_id`, `collection_items.item_type/
   item_id`, `related` в news/memorial_dates, `workflow_history`/`audit_logs` object_type/id.
   Целостность таких ссылок проверяет сервисный слой. Явные M2M: document_tags (тематика),
   document_categories, person_documents, event_documents.

8. **Цикл FK users ↔ branches ↔ digital_files** разорван `use_alter`: FK `users.branch_id` и
   `branches.photo_file_id` создаются в миграции отдельным `create_foreign_key` после таблиц.

9. **Добавлены сущности сверх таблицы §2**: `search_entries` (см. п.2) и `notifications`
   (колокольчик согласования, T6.12), `workflow_history.snapshot` (JSONB для diff версий),
   `audit_logs.actor` (логин для неудачных входов). Модели личного кабинета посетителя (T5.18)
   и статистики просмотров не создавались — их пачки добавят новой миграцией.

10. **Синхронный SQLAlchemy + psycopg 3.** Проще и надёжнее для прототипа; FastAPI выполняет
    sync-эндпоинты в threadpool.

11. **`/api/health`** всегда отвечает (Ollama недоступна → компонент `unavailable`, общий статус
    `degraded`, HTTP 200). HTTP 503 — только если недоступна БД. В ответ не попадают строки
    подключения: только имя класса исключения. Проба эмбеддингов делает реальный
    `/api/embed` с отдельным таймаутом 30 с (первый вызов загружает модель).

12. **Тесты на реальной БД.** pytest использует отдельную базу (`TEST_DATABASE_URL`, по умолчанию
    `<имя>_test` на том же сервере), создаёт её при необходимости и прогоняет миграции с нуля;
    тест `test_models_match_migrations` ловит расхождение моделей и миграций.

13. **Порт PostgreSQL 5432** на хосте был свободен — используется стандартный
    (переопределяется `POSTGRES_PORT` в `.env`).

## 2026-11-10 — B01: исправления по ревью

14. **Собственный уровень доступа у файла.** `digital_files.access` (FileAccess, NOT NULL,
    по умолчанию `needs_review`) — файл, привязанный к экспонату/новости/и т.п., не может
    «унаследовать» открытость от владельца и обойти `documents.file_access`.
    **Правило для `GET /api/files/{id}` (B05/B12):** файл отдаётся, только если
    (а) `digital_files.access` разрешает выдачу этому пользователю **И**
    (б) если `owner_type = 'document'`, то документ существует и его `file_access`
    (и публикация/`description_status`) тоже разрешает. Нет владельца, владелец не найден,
    нет прав или `needs_review` для анонима → **404** (не 403, чтобы не раскрывать существование).
    Проверка — в services через `authorize(user, "file.download", file)`.

15. **`/api/health` публичный → защищён от DoS.** Результат проб Ollama/эмбеддингов кешируется
    в памяти на `HEALTH_CACHE_TTL_SECONDS` (60 с) под `threading.Lock` (одна проба на TTL,
    без «стада»), таймаут проб `HEALTH_PROBE_TIMEOUT_SECONDS` = 3 с (заменяет п.11 про 30 с).
    Имена моделей в ответ не попадают (только статус и `dim=`). Первая проба при «холодной»
    bge-m3 может дать `unavailable` на 60 с — допустимо.

16. **Ограничения схемы (миграция 0002):** номер фонда уникален в пределах архива
    (`UNIQUE NULLS NOT DISTINCT (branch_id, number)`); email уникален без учёта регистра
    (уникальный индекс `lower(email)` вместо регистрозависимого), сервисы хранят email
    нормализованным (strip + lower); CHECK `date_from <= date_to`, `month 1..12`, `day 1..31`,
    `lat -90..90`, `lng -180..180`. PostgreSQL слушает только `127.0.0.1`.

## 2026-11-10 — B12: авторизация, права, согласование, журнал

17. **Сессия админки — JWT (HS256, PyJWT) в httpOnly + Secure + SameSite=Strict cookie `vko_session`.**
    Ключ `JWT_SECRET` только из env (≥ 32 символов, плейсхолдер `change_me…` отклоняется;
    `make env` генерирует случайный). Неактивность 30 мин = `exp`, токен перевыпускается на
    каждом запросе (скользящее окно), но не дольше 12 ч от входа (`auth_time`). Смена пароля
    инвалидирует остальные сессии (claim `pwv` = `password_changed_at`). Деактивация
    пользователя действует сразу (пользователь читается из БД на каждом запросе).
    Ограничение: logout очищает cookie, но не отзывает токен на сервере (нет таблицы сессий,
    чтобы не трогать схему); украденный токен живёт ≤ 30 мин бездействия.
18. **CSRF — токен внутри JWT** (claim `csrf`), фронт получает его в ответе login/`me` и в
    читаемой cookie `vko_csrf` и шлёт в `X-CSRF-Token` на POST/PUT/PATCH/DELETE; сравнение
    `hmac.compare_digest`. Плюс SameSite=Strict.
19. **Пароли — argon2id (argon2-cffi)**, длина 10–256, неизвестный email проверяется против
    фиктивного хеша (одинаковое время ответа). 5 неудач подряд → блок 15 мин (HTTP 429 +
    Retry-After; это раскрывает существование учётки только после 5 попыток — допустимо).
20. **Права — строки `module.action`** (каталог в `services/authz.PERMISSIONS`), матрица в БД
    (`permissions`, `role_permissions`), по умолчанию — `DEFAULT_ROLE_PERMISSIONS`, применяется
    только при создании роли. Главный админ обходит матрицу; `roles.manage` (правка матрицы)
    вне матрицы — только главный админ, чтобы никто не выдал себе права и не запер его.
    Филиальная область: если все роли пользователя из {branch_admin, archivist} и задан
    branch_id (branch_admin — всегда), объект должен принадлежать его филиалу; филиал объекта
    каталога выводится из иерархии case → inventory → fund.branch_id (`documents.branch_id`
    синхронизируется при сохранении через `save_with_version`).
21. **Отказ в доступе журналируется** (`result=denied`) отдельным коммитом после rollback
    запроса. Для `file.download` отказ → 404 (DECISIONS п.14), для остального → 403.
22. **Workflow:** submit (draft/needs_changes→review), return (review/approved→needs_changes,
    комментарий обязателен), approve (review→approved), publish (approved→published),
    archive (published/approved→archived), restore (archived→draft). Оптимистическая
    блокировка `UPDATE … WHERE version=:v` → 409 `version_conflict`. История = снимки в
    `workflow_history.snapshot`, diff считается между соседними снимками. Публикация не
    меняет `file_access`/`digital_files.access`.
23. **Миграция не понадобилась:** модели B01 покрыли все поля; номер `0004_*` не занят.
