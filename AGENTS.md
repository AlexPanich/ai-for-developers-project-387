# AGENTS.md

## Проект

Учебный проект Хекслета «Календарь звонков» — Bun-монорео (`workspaces: ["apps/*"]`), пока на уровне шаблонов:

- `apps/backend` — Elysia + Bun, слушает `:3000`. Entry: `src/index.ts` → `src/app.ts` (export `app`).
- `apps/frontend` — React 19 + Vite, entry: `src/main.tsx`.
- `apps/*/README.md` — шаблонные (Vite/Elysia), не источник правды; источник правды — `package.json`-скрипты и конфиги.
- `.env` и внешних сервисов (БД и т.п.) нет.

## Спецификация

`SPEC.md` — единственный источник правды о поведении продукта и границах того, чего нет. Читать целиком, когда работа касается **поведения приложения** (правила, страницы, тексты, валидация), **API-контракта** (`contract/main.tsp` — он и `SPEC.md` обновляются синхронно) или подготовки **тикетов по спеке**. Формы и эндпоинты не пересказывать — ссылаться на контракт. Термины — `GLOSSARY.md`, причины решений — `docs/adr/`.

## Команды (из корня)

```bash
bun install --frozen-lockfile   # ставить только так — CI делает именно это
bun run lint                     # biome check по всему репо
bun run lint:fix                 # автоисправления
bun run test                     # все тесты (backend + frontend)
bun run test:backend             # только backend
bun run test:e2e                 # E2E (Playwright; один раз локально: bunx playwright install chromium)
bun run test:frontend            # только frontend
bun run dev:backend              # http://localhost:3000
bun run dev:frontend             # vite dev server
bun run build                    # сборка: для фронтенда `tsc -b && vite build`
bun run --filter frontend codegen # типы API и клиентский SDK из contract/openapi.yaml → apps/frontend/src/api/{schema,sdk}.ts
bun run --filter backend codegen  # типы и TypeBox-схемы бэкенда → apps/backend/src/api/{schema,schemas}.ts
bun run --filter backend typecheck # tsc --noEmit по бэкенду
```

Один тест — через скрипт пакета, аргументы после `--`:

```bash
bun run test:backend -- test/smoke.test.ts
bun run test:frontend -- src/App.test.tsx
bun run test:frontend -- -t "Счётчик"   # по названию теста
```

Проверка типов: фронт — `tsc -b` внутри `bun run build` (корневой `bun run build` прогоняет его во всех пакетах, где есть скрипт `build`); бэк — `bun run --filter backend typecheck` (`tsc --noEmit`).

Сгенерированное руками не правится: `contract/openapi.yaml`, `apps/frontend/src/api/schema.ts`, `apps/frontend/src/api/sdk.ts`, `apps/backend/src/api/schema.ts` и `apps/backend/src/api/schemas.ts` — каждый перегенерируется своей командой (`bun run --filter contract compile`, `... frontend codegen`, `... backend codegen`), CI перегенерирует и падает на ручных правках (`git diff --exit-code`).

Порядок проверки: `bun run lint` → `bun run test` (для бэкенда ещё `bun run --filter backend typecheck`); в CI: install → lint → test → регенерация и проверка сгенерированного → typecheck бэкенда.

## Тесты: ловушки

- **Не запускайте тесты frontend из корня напрямую (`bun test ...`)**: preload из `apps/frontend/bunfig.toml` (happy-dom + jest-dom-матчеры) подхватывается только при cwd = `apps/frontend`, и тесты падают с `ReferenceError: document is not defined`. Из корня используйте `bun run test:frontend -- ...`.
- **Авто-cleanup `@testing-library/react` не включается** (в `bun:test` `afterEach` не глобальный): каждый React-тест вызывает `cleanup()` в своём `afterEach`, иначе рендеры накапливаются и запросы падают с «Found multiple elements».
- Тесты только на `bun:test` (не vitest/jest).
- Smoke-тест backend поднимает реальный HTTP-сервер на эфемерном порту (`app.listen(0)`) — внешние сервисы и ожидания не нужны.
- **E2E (Playwright)** лежат в `e2e/` и не входят в `bun run test`: запуск — `bun run test:e2e`. Их `webServer` сам собирает фронт и поднимает API на `:4180` с изолированной БД (`.playwright/data.db`), dev-`apps/backend/data.db` не трогается; перед первым запуском — `bunx playwright install chromium`.
- После изменения зависимостей не забудьте закоммитить обновлённый `bun.lock` — в CI стоит `--frozen-lockfile`.

## Линт и формат

- Единственный линтер — **Biome**; eslint и другие линтеры не используются.
- Корневой `biome.json` действует на весь репо, **проверяет и JSON** — новые `.json`-файлы форматировать по его правилам (2 пробела, без trailing commas).
- `apps/*/biome.json` наследуют корневой (`"extends": "//"`): frontend — кавычки одинарные (JSX — двойные), linter исключает `public/**`; backend — глобальные `Bun`, `process`.

## Git, CI, релизы

- Ветка по умолчанию — `master`.
- **Conventional Commits обязательны для всех коммитов, включая коммиты агента**:
  `type(scope)!: description`; типы `feat` `fix` `docs` `style` `refactor` `perf`
  `test` `build` `ci` `chore` `revert`; breaking change — `!` после типа или футер
  `BREAKING CHANGE: ...`. Подробности и примеры — в `CONTRIBUTING.md`. От формата
  зависят версии и `CHANGELOG.md`.
- Три workflow в `.github/workflows/`:
  - `ci.yml` — install (frozen) → lint → test на **каждый push**; параллельно job `e2e` (Playwright: сборка фронта и сквозной сценарий);
  - `hexlet-check.yml` — **генерируется Хекслетом: не редактировать, не удалять, не переименовывать** (то же касается репозитория);
  - `release-please.yml` — на push в `master` держит release-PR.
- Релизы: release-please (`release-please-config.json`, `release-type: node`, путь `.`) ведёт версию в `version` корневого `package.json` и `.release-please-manifest.json`, пишет `CHANGELOG.md`, ставит теги `vX.Y.Z`. Release-PR открывается только при наличии `feat:`/`fix:`/breaking-коммитов. Бамп версии не ломает `bun install --frozen-lockfile`.
- Деплой: Render Web Service `hexlet-call-calendar` (`srv-db2agh6i0phs73dv8pag`, docker, frankfurt, free), autoDeploy на push в `master`; MCP-инструменты `render` — конфигурация в корневом `opencode.json` (API key в `RENDER_API_KEY`, в репозиторий не попадает). Данные на проде эфемерные (SQLite в контейнере сбрасывается при деплое).
- `.gitignore` в корне: `node_modules/`, `dist/` — не коммитить.

## Agent skills

### Issue tracker

Issues живут в GitHub Issues этого репо, все операции через `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Дефолтные пять канонических ролей, имя лейбла = имя роли. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md` + `docs/adr/` в корне. See `docs/agents/domain.md`.
