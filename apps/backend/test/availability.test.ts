import { afterAll, afterEach, describe, expect, setSystemTime, test } from "bun:test"
import { createApp } from "../src/app"
import {
  createEventType,
  errorEnvelope,
  get,
  insertBooking,
  removeTempDbs,
  tempDbPath,
} from "./support"

afterEach(() => {
  // Замороженное время не должно протекать в другие тесты прогона
  setSystemTime()
})

afterAll(() => {
  removeTempDbs()
})

/** Доступность типа: возвращает слоты или падает, если ответ не 200. */
async function availability(
  app: ReturnType<typeof createApp>,
  id: string,
): Promise<{ slots: { startAt: string; available: boolean }[] }> {
  const response = await get(app, `/api/event-types/${id}/availability`)
  expect(response.status).toBe(200)
  return (await response.json()) as { slots: { startAt: string; available: boolean }[] }
}

describe("§3 Сетка времени и слоты", () => {
  test("§3: старты только по сетке 09:00–17:30 с шагом 30 минут на всём окне", async () => {
    setSystemTime(new Date("2026-10-06T08:00:00+03:00"))
    const app = createApp({ dbPath: tempDbPath() })
    const type = await createEventType(app, { durationMinutes: 30 })

    const { slots } = await availability(app, type.id)

    // Окно §4: 15 календарных суток МСК с 2026-10-06 по 2026-10-20, по 18 стартов §3
    expect(slots).toHaveLength(15 * 18)
    expect(slots[0]?.startAt).toBe("2026-10-06T09:00:00+03:00")
    expect(slots[slots.length - 1]?.startAt).toBe("2026-10-20T17:30:00+03:00")
    // Ни одного дубля и ни одного старта вне сетки: только 09|10…17 : 00|30
    expect(new Set(slots.map((slot) => slot.startAt)).size).toBe(slots.length)
    for (const slot of slots) {
      expect(slot.startAt).toMatch(/^2026-10-\d{2}T(?:09|1[0-7]):(?:00|30):00\+03:00$/)
    }
    // Сутки окна целиком: 15 разных дат
    expect(new Set(slots.map((slot) => slot.startAt.slice(0, 10))).size).toBe(15)
  })

  test("§3: тип, не помещающийся до 18:00, не предлагается — у 45-минутного нет старта 17:30", async () => {
    setSystemTime(new Date("2026-10-06T08:00:00+03:00"))
    const app = createApp({ dbPath: tempDbPath() })
    const type = await createEventType(app, { durationMinutes: 45 })

    const { slots } = await availability(app, type.id)

    // 45 минут от 17:30 кончаются в 18:15 → такой старт исключается (§3)
    expect(slots.some((slot) => slot.startAt.includes("T17:30"))).toBe(false)
    expect(slots).toHaveLength(15 * 17)
    const firstDay = slots.filter((slot) => slot.startAt.startsWith("2026-10-06"))
    expect(firstDay[firstDay.length - 1]?.startAt).toBe("2026-10-06T17:00:00+03:00")
  })
})

describe("§4 Доступность и окно 14 дней", () => {
  // Границы окна — календарные сутки МСК: даже когда по UTC ещё вчерашний
  // день, окно начинается с сегодняшних по Москве суток (§4).
  test("§4: границы окна — по Москве, а не по поясу сервера", async () => {
    setSystemTime(new Date("2026-10-07T00:30:00+03:00"))
    const app = createApp({ dbPath: tempDbPath() })
    const type = await createEventType(app, { durationMinutes: 30 })

    const { slots } = await availability(app, type.id)

    expect(slots[0]?.startAt).toBe("2026-10-07T09:00:00+03:00")
    expect(slots[slots.length - 1]?.startAt).toBe("2026-10-21T17:30:00+03:00")
    expect(slots.some((slot) => slot.startAt.startsWith("2026-10-06"))).toBe(false)
  })

  test("§4: прошедший старт остаётся в списке с available: false", async () => {
    setSystemTime(new Date("2026-10-06T12:00:00+03:00"))
    const app = createApp({ dbPath: tempDbPath() })
    const type = await createEventType(app, { durationMinutes: 30 })

    const { slots } = await availability(app, type.id)
    const byStart = new Map(slots.map((slot) => [slot.startAt, slot.available]))

    expect(slots.some((slot) => slot.startAt === "2026-10-06T09:00:00+03:00")).toBe(true)
    expect(byStart.get("2026-10-06T09:00:00+03:00")).toBe(false)
    expect(byStart.get("2026-10-06T11:30:00+03:00")).toBe(false)
    expect(byStart.get("2026-10-06T12:00:00+03:00")).toBe(true)
    expect(byStart.get("2026-10-06T12:30:00+03:00")).toBe(true)
  })

  test("§4: старт с пересечением чужого бронирования занят, соседние свободны", async () => {
    setSystemTime(new Date("2026-10-06T08:00:00+03:00"))
    const dbPath = tempDbPath()
    const app = createApp({ dbPath })
    // Чужое бронирование другого типа: 10:00–10:45 по Москве
    const other = await createEventType(app, { name: "Разбор", durationMinutes: 45 })
    insertBooking(dbPath, {
      id: crypto.randomUUID(),
      eventTypeId: other.id,
      startAt: "2026-10-08T10:00:00+03:00",
    })
    const type = await createEventType(app, { durationMinutes: 30 })

    const { slots } = await availability(app, type.id)
    const byStart = new Map(slots.map((slot) => [slot.startAt, slot.available]))

    // [10:00,10:30) и [10:30,11:00) пересекаются с [10:00,10:45) → заняты (§4)
    expect(byStart.get("2026-10-08T10:00:00+03:00")).toBe(false)
    expect(byStart.get("2026-10-08T10:30:00+03:00")).toBe(false)
    // Соседние старты не пересекаются с чужим бронированием → свободны
    expect(byStart.get("2026-10-08T09:30:00+03:00")).toBe(true)
    expect(byStart.get("2026-10-08T11:00:00+03:00")).toBe(true)
  })

  test("§4: бронирование внутри окна не исчезает, когда окно уезжает", async () => {
    setSystemTime(new Date("2026-10-06T08:00:00+03:00"))
    const dbPath = tempDbPath()
    const app = createApp({ dbPath })
    const other = await createEventType(app, { name: "Разбор", durationMinutes: 45 })
    insertBooking(dbPath, {
      id: crypto.randomUUID(),
      eventTypeId: other.id,
      startAt: "2026-10-08T10:00:00+03:00",
    })
    const type = await createEventType(app, { durationMinutes: 30 })

    // Окно уехало на сутки: день бронирования всё ещё внутри окна §4
    setSystemTime(new Date("2026-10-07T08:00:00+03:00"))
    const { slots } = await availability(app, type.id)
    const byStart = new Map(slots.map((slot) => [slot.startAt, slot.available]))

    expect(slots[0]?.startAt).toBe("2026-10-07T09:00:00+03:00")
    // Бронирование, созданное внутри окна, по-прежнему занимает свои старты
    expect(byStart.get("2026-10-08T10:00:00+03:00")).toBe(false)
    expect(byStart.get("2026-10-08T10:30:00+03:00")).toBe(false)
    expect(byStart.get("2026-10-08T09:30:00+03:00")).toBe(true)
  })

  test("§8: несуществующий тип → 404 EVENT_TYPE_NOT_FOUND", async () => {
    const app = createApp({ dbPath: tempDbPath() })

    const response = await get(
      app,
      "/api/event-types/3f1d4f8a-1b7c-4f1e-9f3a-0b1c2d3e4f56/availability",
    )

    expect(response.status).toBe(404)
    expect((await errorEnvelope(response)).code).toBe("EVENT_TYPE_NOT_FOUND")
  })
})
