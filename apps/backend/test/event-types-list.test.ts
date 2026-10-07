import { afterAll, describe, expect, test } from "bun:test"
import { createApp, OWNER_PASSWORD } from "../src/app"
import { get, post, removeTempDbs, tempDbPath, VALID_EVENT_TYPE } from "./support"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

afterAll(() => {
  removeTempDbs()
})

async function create(app: ReturnType<typeof createApp>, name: string): Promise<{ id: string }> {
  const response = await post(
    app,
    "/api/event-types",
    { ...VALID_EVENT_TYPE, name },
    { "X-Admin-Password": OWNER_PASSWORD },
  )
  expect(response.status).toBe(201)
  return (await response.json()) as { id: string }
}

/** Ожидаемое тело типа события: остальные поля — из фикстуры §7. */
function expectedType(name: string, id: string): Record<string, unknown> {
  return {
    id,
    name,
    description: VALID_EVENT_TYPE.description,
    durationMinutes: VALID_EVENT_TYPE.durationMinutes,
  }
}

describe("§6 Список типов событий", () => {
  test("§6: пустой сервис → 200 с пустым списком", async () => {
    const app = createApp({ dbPath: tempDbPath() })

    const response = await get(app, "/api/event-types")

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ eventTypes: [] })
  })

  test("§6: список отдаёт все созданные типы с названием, описанием и длительностью", async () => {
    const app = createApp({ dbPath: tempDbPath() })
    const first = await create(app, "Созвон")
    const second = await create(app, "Разбор")

    const response = await get(app, "/api/event-types")

    expect(response.status).toBe(200)
    const body = (await response.json()) as { eventTypes: Record<string, unknown>[] }
    expect(body.eventTypes).toHaveLength(2)
    expect(body.eventTypes).toEqual(
      expect.arrayContaining([expectedType("Созвон", first.id), expectedType("Разбор", second.id)]),
    )
    for (const type of body.eventTypes) {
      expect(type.id).toMatch(UUID)
    }
  })

  test("§6: GET /api/event-types/{id} отдаёт тип для страницы /book/:id", async () => {
    const app = createApp({ dbPath: tempDbPath() })
    const created = await create(app, "Созвон")

    const response = await get(app, `/api/event-types/${created.id}`)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(expectedType("Созвон", created.id))
  })
})
