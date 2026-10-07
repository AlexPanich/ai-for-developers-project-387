import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { mkdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createHostApp, resolveAsset } from "../src/host"
import { post, removeTempDbs, tempDbPath, VALID_EVENT_TYPE } from "./support"

const INDEX_HTML = "<!doctype html><html><title>Календарь звонков</title></html>"
const assetsDir = join(tmpdir(), `calendar-dist-${crypto.randomUUID()}`)

beforeAll(() => {
  mkdirSync(join(assetsDir, "assets"), { recursive: true })
  writeFileSync(join(assetsDir, "index.html"), INDEX_HTML)
  writeFileSync(join(assetsDir, "assets", "app.js"), "console.log('app')")
})

afterAll(() => {
  rmSync(assetsDir, { recursive: true, force: true })
  removeTempDbs()
})

const app = createHostApp({ assetsDir, dbPath: tempDbPath() })

describe("Хост контейнера: SPA и API на одном порту", () => {
  test("§6: GET / отдаёт страницу лендинга", async () => {
    const response = await app.handle(new Request("http://localhost/"))

    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toContain("text/html")
    expect(await response.text()).toBe(INDEX_HTML)
  })

  test("§6: глубокая ссылка /book отдаёт страницу лендинга", async () => {
    const response = await app.handle(new Request("http://localhost/book"))

    expect(response.status).toBe(200)
    expect(await response.text()).toBe(INDEX_HTML)
  })

  test("сборка фронта отдаётся как есть: /assets/app.js", async () => {
    const response = await app.handle(new Request("http://localhost/assets/app.js"))

    expect(response.status).toBe(200)
    expect(await response.text()).toBe("console.log('app')")
  })

  test("§7: GET /api/event-types → JSON-список, не перекрытый SPA", async () => {
    const response = await app.handle(new Request("http://localhost/api/event-types"))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ eventTypes: [] })
  })

  test("§7: через хост создаётся тип события: POST → 201", async () => {
    const response = await post(app, "/api/event-types", VALID_EVENT_TYPE, {
      "X-Admin-Password": "secret",
    })

    expect(response.status).toBe(201)
    expect((await response.json()) as { id: string }).toHaveProperty("id")
  })

  test("неизвестный /api/*-путь → 404, а не index.html", async () => {
    const response = await app.handle(new Request("http://localhost/api/nope"))

    expect(response.status).toBe(404)
    expect(await response.text()).not.toBe(INDEX_HTML)
  })

  test("URL-нормализация не выводит за каталог: /%2e%2e/package.json → index.html", async () => {
    const response = await app.handle(new Request("http://localhost/%2e%2e/package.json"))

    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toContain("text/html")
    expect(await response.text()).toBe(INDEX_HTML)
  })

  test("resolveAsset отдаёт null для пути наружу (path traversal)", async () => {
    expect(await resolveAsset(assetsDir, "/../package.json")).toBeNull()
    expect(await resolveAsset(assetsDir, "/assets/app.js")).not.toBeNull()
  })
})
