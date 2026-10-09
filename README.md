# Календарь звонков (продолжение)

[![hexlet-check](https://github.com/AlexPanich/ai-for-developers-project-387/actions/workflows/hexlet-check.yml/badge.svg)](https://github.com/AlexPanich/ai-for-developers-project-387/actions)
[![CI](https://github.com/AlexPanich/ai-for-developers-project-387/actions/workflows/ci.yml/badge.svg)](https://github.com/AlexPanich/ai-for-developers-project-387/actions/workflows/ci.yml)

> **Это продолжение проекта** «Календарь звонков». Репозиторий
> [предыдущего проекта](https://github.com/AlexPanich/ai-for-developers-project-386) перенесён
> сюда целиком: приложение, тесты, линтер, Dockerfile, воркфлоу GitHub Actions,
> release-please и `AGENTS.md` — всё это остаётся рабочим и используется дальше.

Сервис, в котором гость без регистрации выбирает тип события и бронирует слот у единственного владельца. Гость оставляет имя и email; аккаунтов нет. Владелец создаёт типы событий и видит предстоящие встречи — они видны всем, входа нет.

Старты лежат на сетке с 09:00 до 18:00 по Москве с шагом 30 минут, а длительность задаёт тип события: 45 минут занимают два стартов и не помещаются на 17:30. Одно время бронируется не более одного раза, даже у разных типов событий. Выбор ограничен окном в 14 дней, отмены и изменения бронирования нет. Правила целиком — в [SPEC.md](SPEC.md), термины — в [GLOSSARY.md](GLOSSARY.md).

- Учебный проект Хекслета: <https://ru.hexlet.io/programs/ai-for-developers>
- Как это должно работать: <https://files.hexlet.app/a/2ipc5m>

## Статус

Проект в разработке. Инфраструктура готова и работает: монорео, линтер, тесты, CI на каждый push и автоматические релизы. Функциональность сервиса дорабатывается.

## Стек

| Слой | Технологии |
|---|---|
| Бекенд | Bun, TypeScript, [Elysia](https://elysiajs.com) |
| Фронтенд | React 19, TypeScript, [Vite](https://vite.dev) |
| Качество кода | [Biome](https://biomejs.dev) (линтер + форматтер), Bun Test |
| Автоматизация | GitHub Actions, release-please |

## Установка

Требуется [Bun](https://bun.sh) 1.4 или новее.

```bash
git clone https://github.com/AlexPanich/ai-for-developers-project-387.git
cd ai-for-developers-project-387
bun install
```

## Запуск

```bash
bun run dev            # бекенд и фронтенд одновременно
bun run dev:backend    # API  → http://localhost:3000
bun run dev:frontend   # SPA  → http://localhost:5173
```

## Запуск в контейнере

Корневой `Dockerfile` собирает приложение и запускает его на порту из переменной `PORT` — по этому контракту работает автопроверка Хекслета (`PORT=8080`, `GET /` → 200):

```bash
docker build -t calendar-slot .
docker run --rm -p 8080:8080 -e PORT=8080 calendar-slot
# → http://localhost:8080 — лендинг, на том же порту API /api/...
```

Образ ставит зависимости строго по `bun.lock`, собирает фронтенд внутри (`bun run build`) и отдаёт его бекенд: точные роуты API бьют SPA-фолбэк, неизвестные `/api/*`-пути дают 404, остальные GET-пути — `index.html` (работают глубокие ссылки `/book`, `/admin`). `docker-compose.yml` не нужен: автопроверка его не читает (решение в [issue #14](https://github.com/AlexPanich/ai-for-developers-project-386/issues/14)).

## Деплой

Прод: <https://hexlet-call-calendar.onrender.com> — Render Web Service (runtime Docker, регион `frankfurt`, план Free, health check `GET /`).

- Сборка идёт из корневого `Dockerfile` и запускается автоматически на каждый push в `master` (`autoDeploy`); вручную — кнопкой Redeploy в [дашборде](https://dashboard.render.com/web/srv-db2agh6i0phs73dv8pag) или `trigger_deploy` через Render MCP.
- **Данные эфемерные**: SQLite-файл живёт внутри контейнера, поэтому при каждом деплое/рестарте типы событий и бронирования сбрасываются. Для учебной сдачи это осознанный выбор (бесплатный план без диска, см. [ADR 0001](docs/adr/0001-sqlite-storage.md)); постоянный диск или Postgres — вне скоупа.
- Сервис создан через Render MCP (`create_web_service`); доступ к аккаунту Render — по API key в переменной `RENDER_API_KEY` (конфиг MCP — `~/.config/opencode/opencode.jsonc`, ключ в репозиторий не попадает).

## Команды

| Команда | Что делает |
|---|---|
| `bun run lint` | Проверка линтером и форматированием (Biome) |
| `bun run lint:fix` | Автоисправление замечаний линтера |
| `bun run format` | Форматирование кода |
| `bun run test` | Тесты бекенда и фронтенда |
| `bun run test:backend` | Только тесты бекенда |
| `bun run test:frontend` | Только тесты фронтенда |
| `bun run build` | Сборка: для фронтенда `tsc -b` (проверка типов) и `vite build` |
| `bun run --filter frontend codegen` | Генерация типов API фронтенда из `contract/openapi.yaml` |

Запуск одного теста — через скрипт пакета: `bun run test:frontend -- -t "Название теста"`.

## Контракт API и генерация

Источник правды для API — TypeSpec, [`contract/main.tsp`](contract/main.tsp). Открытая спецификация `contract/openapi.yaml` **генерируется** из него одной командой:

```bash
bun run --filter contract compile
```

Сгенерированное руками не правится: CI перегенерирует спецификацию и падает, если файл изменён вручную (`git diff --exit-code -- contract/openapi.yaml`). Направление дальнейшей генерации зафиксировано в [ADR 0002](docs/adr/0002-generation-from-contract.md).

**Типы фронтенда** берутся из `contract/openapi.yaml` командой пакета frontend:

```bash
bun run --filter frontend codegen
```

Команда пишет `apps/frontend/src/api/schema.ts`; файл коммитится и правится только генерацией — CI перегенерирует его и падает на ручных правках (`git diff --exit-code -- apps/frontend/src/api/schema.ts`).

**Схемы и типы бекенда** генерируются командой пакета backend:

```bash
bun run --filter backend codegen
```

Команда пишет два файла: `apps/backend/src/api/schema.ts` (типы, `openapi-typescript`) и `apps/backend/src/api/schemas.ts` (TypeBox-схемы `t.*` — валидация body/params и сериализация ответов в Elysia; конвертер `apps/backend/scripts/openapi-to-typebox.ts`). Оба файла коммитятся и правятся только генерацией, CI проверяет их так же (`git diff --exit-code`). Проверка типов бекенда — `bun run --filter backend typecheck`.

Клиент API фронтенда (`apps/frontend/src/api`) собирается поверх этих типов: успешные тела типизированы сгенерированными моделями, конверт `{ error: { code, message } }` разбирает обёртка `request`, и на экран ошибка доходит как `error.message`. Пути запросов относительные (`/api/...`): в dev Vite проксирует их на бекенд (`apps/frontend/vite.config.ts`).

Роуты бекенда (`apps/backend/src/app.ts`) объявляются вручную и подставляют сгенерированные схемы как валидацию входа и сериализацию ответов; почему именно так — [ADR 0002](docs/adr/0002-generation-from-contract.md).

## Структура репозитория

```
apps/
  backend/    # API на Elysia (порт 3000)
    src/app.ts      — само приложение (роуты)
    src/index.ts    — точка входа, запуск сервера
    test/           — интеграционные smoke-тесты
  frontend/   # SPA на React + Vite (порт 5173)
    src/            — компоненты, стили, тесты
```

Монорео на Bun workspaces: команды из корня выполняются во всех пакетах.

## Качество кода и CI

На каждый push GitHub Actions запускает:

- **CI** (`ci.yml`) — установка зависимостей (`--frozen-lockfile`), линтер, тесты, перегенерация контракта и типов/схем API с проверкой, что сгенерированное закоммичено, typecheck бэкенда;
- **hexlet-check** (`hexlet-check.yml`) — автотесты Хекслета.

То же самое локально, перед каждым коммитом:

```bash
bun run lint && bun run test
```

## Воркфлоу GitHub Actions

| Воркфлоу | Файл | Событие | Модель | Назначение | Прогоны |
|---|---|---|---|---|---|
| CI | `ci.yml` | `push` (все ветки) | — | линтер, тесты, перегенерация контракта и типов/схем API, typecheck бэкенда, E2E | Actions → **CI** |
| hexlet-check | `hexlet-check.yml` | `push` (все ветки и теги) | — | автотесты Хекслета (генерируется, не редактировать) | Actions → **hexlet-check** |
| release-please | `release-please.yml` | `push` в `master` | — | release-PR, версия, `CHANGELOG.md`, теги | Actions → **release-please** |
| OpenCode PR Review | `opencode-review.yml` | `pull_request` (`opened`, `synchronize`, `reopened`, `ready_for_review`; не от бота) | `opencode/mimo-v2.6-flash-free` | ревью PR агентом | Actions → **OpenCode PR Review** |
| opencode | `opencode.yml` | `issue_comment` / `pull_request_review_comment` (`/oc`, `/opencode`; автор-мейнтейнер; не от бота) | `opencode/mimo-v2.6-flash-free` | задача агенту прямо из комментария | Actions → **opencode** |
| Issue Triage | `opencode-triage.yml` | `issues` (`opened`; не от бота; аккаунт старше 30 дней) | `opencode/mimo-v2.6-flash-free` | триаж нового issue: метка + комментарий | Actions → **Issue Triage** |
| Manual OpenCode Task | `opencode-manual.yml` | `workflow_dispatch` (вручную) | на выбор, по умолчанию `opencode/mimo-v2.6-flash-free` | произвольная задача агенту | Actions → **Manual OpenCode Task** → Run workflow |
| Weekly Dependency Audit | `opencode-schedule-check-dependencies.yml` | `schedule` (пн 09:00 UTC) + `workflow_dispatch` | на выбор, по умолчанию `opencode/mimo-v2.6-flash-free` | аудит уязвимостей и устаревших зависимостей → issue | Actions → **Weekly Dependency Audit** |
| Weekly TODO Audit | `opencode-schedule-check-todo.yml` | `schedule` (вт 09:00 UTC) | `opencode/mimo-v2.6-flash-free` | поиск `TODO`/`FIXME`/`HACK` → issue | Actions → **Weekly TODO Audit** |

Прогоны смотрят на вкладке **Actions**: список слева фильтруется по имени воркфлоу; для ручных — кнопка **Run workflow** внутри самого воркфлоу.

## Коммиты и релизы

- Сообщения коммитов — по спецификации
  [Conventional Commits](https://www.conventionalcommits.org/ru/v1.0.0/):
  `feat: добавить слоты`, `fix: починить часовой пояс`, `chore: обновить зависимости`.
  Полные правила — в [CONTRIBUTING.md](CONTRIBUTING.md).
- Релизы автоматические: **release-please** читает историю коммитов, считает версию
  по [семантическому версионированию](https://semver.org/lang/ru/), собирает
  `CHANGELOG.md` и держит release-PR открытым. Смержили release-PR — появляется
  тег `vX.Y.Z` и GitHub Release.

---

<details>
<summary>Автоматические тесты Хекслета</summary>

Тесты запускаются на каждый коммит. За запуск отвечает файл `.github/workflows/hexlet-check.yml` — не удаляйте и не переименовывайте ни его, ни репозиторий.

</details>

## О Хекслете

[Хекслет](https://ru.hexlet.io/) — школа программирования: авторские программы обучения с практикой, поддержкой наставников и реальными проектами, которые остаются в резюме. Этот репозиторий — один из таких проектов.
