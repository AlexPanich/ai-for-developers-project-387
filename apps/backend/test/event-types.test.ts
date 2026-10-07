import { Database } from "bun:sqlite"
import { afterAll, describe, expect, test } from "bun:test"
import { createApp, OWNER_PASSWORD } from "../src/app"
import {
  countEventTypes,
  errorEnvelope,
  post,
  removeTempDbs,
  tempDbPath,
  VALID_EVENT_TYPE,
} from "./support"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

afterAll(() => {
  removeTempDbs()
})

describe("§7 Владелец: создание типа события", () => {
  test("§7: верный пароль → 201 с UUID и полями формы", async () => {
    const app = createApp({ dbPath: tempDbPath() })

    const response = await post(app, "/api/event-types", VALID_EVENT_TYPE, {
      "X-Admin-Password": OWNER_PASSWORD,
    })

    expect(response.status).toBe(201)
    const body = (await response.json()) as Record<string, unknown>
    expect(body.id).toMatch(UUID)
    expect(body.name).toBe(VALID_EVENT_TYPE.name)
    expect(body.description).toBe(VALID_EVENT_TYPE.description)
    expect(body.durationMinutes).toBe(VALID_EVENT_TYPE.durationMinutes)
  })

  test("§7: созданное сохраняется в SQLite-файле приложения", async () => {
    const dbPath = tempDbPath()
    const app = createApp({ dbPath })

    const response = await post(app, "/api/event-types", VALID_EVENT_TYPE, {
      "X-Admin-Password": OWNER_PASSWORD,
    })
    const body = (await response.json()) as { id: string }

    const database = new Database(dbPath, { readonly: true })
    const row = database
      .query("SELECT id, name, description, duration_minutes FROM event_types")
      .get() as Record<string, unknown>
    database.close()

    expect(row).toEqual({
      id: body.id,
      name: VALID_EVENT_TYPE.name,
      description: VALID_EVENT_TYPE.description,
      duration_minutes: VALID_EVENT_TYPE.durationMinutes,
    })
  })

  test("§7: последовательные создания дают разные id и обе строки в БД", async () => {
    const dbPath = tempDbPath()
    const app = createApp({ dbPath })
    const headers = { "X-Admin-Password": OWNER_PASSWORD }

    const first = (await (
      await post(app, "/api/event-types", VALID_EVENT_TYPE, headers)
    ).json()) as { id: string }
    const second = (await (
      await post(app, "/api/event-types", { ...VALID_EVENT_TYPE, name: "Разбор" }, headers)
    ).json()) as { id: string }

    expect(first.id).not.toBe(second.id)
    expect(countEventTypes(dbPath)).toBe(2)
  })

  test("§7: неверный пароль → 401 и ничего не записано", async () => {
    const dbPath = tempDbPath()
    const app = createApp({ dbPath })

    const response = await post(app, "/api/event-types", VALID_EVENT_TYPE, {
      "X-Admin-Password": "wrong-password",
    })

    expect(response.status).toBe(401)
    expect((await errorEnvelope(response)).code).toBe("INVALID_ADMIN_PASSWORD")
    expect(countEventTypes(dbPath)).toBe(0)
  })

  // Обе стороны обязаны называть один пароль: бэкенд сверяет заголовок, фронтенд
  // сравнивает в route guard и шлёт в X-Admin-Password (§7). Разойдутся — Владелец
  // потеряет доступ, поэтому дрейф ловится тестами с обеих сторон.
  test("§7: пароль Владельца — «secret», как в route guard на фронте", () => {
    expect(OWNER_PASSWORD).toBe("secret")
  })
})
