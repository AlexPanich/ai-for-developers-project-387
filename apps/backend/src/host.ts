import { join, sep } from "node:path"
import { Elysia } from "elysia"
import { createApp } from "./app"

/**
 * Хост контейнера (прод): SPA фронта и API бэкенда на одном порту.
 *
 * Точные роуты API бьют wildcard-правила хоста; неизвестные `/api/*`-пути дают
 * 404, а остальные GET-пути — index.html, чтобы работали глубокие ссылки
 * фронтового роутера (`/book`, `/admin` и т.д., §6).
 */
export function createHostApp(options: { assetsDir: string; dbPath?: string }) {
  const indexHtmlPath = join(options.assetsDir, "index.html")

  return new Elysia()
    .use(createApp({ dbPath: options.dbPath }))
    .get("/", () => Bun.file(indexHtmlPath))
    .get("/*", async (ctx) => {
      const pathname = new URL(ctx.request.url).pathname

      if (pathname.startsWith("/api/")) {
        ctx.set.status = 404
        return "Not Found"
      }

      const asset = await resolveAsset(options.assetsDir, pathname)
      if (asset) return asset

      ctx.set.status = 200
      return Bun.file(indexHtmlPath)
    })
}

/**
 * Путь запроса → файл каталога сборки; `null` — файла нет или путь ведёт
 * наружу каталога (path traversal).
 *
 * `pathname` приходит из URL, где сегменты `..` нормализуются ещё на разборе,
 * — доходим до этой проверки только мы, если источник пути изменится.
 * Отдельная функция, а не строка в хендлере, чтобы защиту можно было покрыть
 * тестом напрямую.
 */
export async function resolveAsset(assetsDir: string, pathname: string) {
  const root = assetsDir.endsWith(sep) ? assetsDir : assetsDir + sep
  const resolved = join(assetsDir, pathname)
  if (!resolved.startsWith(root)) return null
  const file = Bun.file(resolved)
  return (await file.exists()) ? file : null
}
