# Contributing

## Формат сообщений коммитов

Проект использует спецификацию [Conventional Commits 1.0.0](https://www.conventionalcommits.org/ru/v1.0.0/):

```
<type>[optional scope][!]: <description>
```

Типы: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`,
`ci`, `chore`, `revert`.

Примеры:

```
feat(backend): add booking endpoint
fix(frontend): correct calendar timezone rendering
chore: update dependencies
```

Breaking change помечается `!` после типа (`feat!:`) или футером
`BREAKING CHANGE: ...`. Полный список типов и правила — в [AGENTS.md](AGENTS.md).

## Релизы

Релизы автоматизированы через [release-please](https://github.com/googleapis/release-please)
(workflow `.github/workflows/release-please.yml`):

1. Коммиты `feat:`/`fix:` попадают на `master` — release-please открывает
   **release-PR** с предложенной версией по правилам
   [семантического версионирования](https://semver.org/lang/ru/) и
   обновлённым `CHANGELOG.md`.
2. Мержите release-PR — создаётся тег `vX.Y.Z` и GitHub Release,
   `CHANGELOG.md` обновляется в `master`.
3. Коммиты прочих типов (`chore`, `docs`, `ci`, ...) на версию не влияют.

Текущая версия хранится в `.release-please-manifest.json` и в поле `version`
корневого `package.json`.

## Проверки

Перед коммитом:

```bash
bun install --frozen-lockfile
bun run lint
bun run test
```

Те же проверки запускает GitHub Actions на каждый push (`.github/workflows/ci.yml`).
