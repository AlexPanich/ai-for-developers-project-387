import { afterAll, afterEach, beforeEach, describe, expect, setSystemTime, test } from "bun:test"
import { createApp } from "../src/app"
import {
  bookingPayload,
  createEventType,
  errorEnvelope,
  GUEST,
  get,
  post,
  removeTempDbs,
  tempDbPath,
} from "./support"

/** Замороженное «сейчас»: вторник утром, окно §4 — сутки МСК 2026-10-06…2026-10-20. */
const NOW = new Date("2026-10-06T08:00:00+03:00")

/** Тело бронирования (§5): пять полей, `id` генерирует бэк. */
interface BookingBody {
  id: string
  eventTypeId: string
  startAt: string
  guestName: string
  guestEmail: string
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

/** Слоты типа: отвечает 200 или падает с текстом ответа. */
async function availability(
  app: ReturnType<typeof createApp>,
  id: string,
): Promise<{ slots: { startAt: string; available: boolean }[] }> {
  const response = await get(app, `/api/event-types/${id}/availability`)
  expect(response.status).toBe(200)
  return (await response.json()) as { slots: { startAt: string; available: boolean }[] }
}

beforeEach(() => {
  setSystemTime(NOW)
})

afterEach(() => {
  // Замороженное время не должно протекать в другие тесты прогона
  setSystemTime()
})

afterAll(() => {
  removeTempDbs()
})

describe("§5 Бронирование гостем", () => {
  test("§5: корректные данные → 201 и объект { id, eventTypeId, startAt, guestName, guestEmail }", async () => {
    const app = createApp({ dbPath: tempDbPath() })
    const type = await createEventType(app)
    const startAt = "2026-10-06T09:00:00+03:00"

    const response = await post(app, "/api/bookings", bookingPayload(type.id, startAt))

    expect(response.status).toBe(201)
    const booking = (await response.json()) as BookingBody
    expect(booking.id).toMatch(UUID_RE)
    expect(booking.eventTypeId).toBe(type.id)
    expect(booking.startAt).toBe(startAt)
    expect(booking.guestName).toBe(GUEST.guestName)
    expect(booking.guestEmail).toBe(GUEST.guestEmail)
  })

  test("§5: после бронирования availability сразу возвращает это время занятым", async () => {
    const app = createApp({ dbPath: tempDbPath() })
    const type = await createEventType(app, { durationMinutes: 30 })
    const startAt = "2026-10-06T10:00:00+03:00"
    const before = await availability(app, type.id)

    const response = await post(app, "/api/bookings", bookingPayload(type.id, startAt))
    expect(response.status).toBe(201)

    const after = await availability(app, type.id)
    const freeBefore = before.slots.filter((slot) => slot.available).length
    const freeAfter = after.slots.filter((slot) => slot.available).length
    expect(freeAfter).toBe(freeBefore - 1)
    expect(after.slots.find((slot) => slot.startAt === startAt)?.available).toBe(false)
  })

  test("§8: несуществующий тип события → 404 EVENT_TYPE_NOT_FOUND", async () => {
    const app = createApp({ dbPath: tempDbPath() })

    const response = await post(
      app,
      "/api/bookings",
      bookingPayload(crypto.randomUUID(), "2026-10-06T09:00:00+03:00"),
    )

    expect(response.status).toBe(404)
    expect((await errorEnvelope(response)).code).toBe("EVENT_TYPE_NOT_FOUND")
  })
})

describe("§8 Занятость времени — 409", () => {
  test("§8: повторное бронирование того же старта → 409 SLOT_TAKEN", async () => {
    const app = createApp({ dbPath: tempDbPath() })
    const type = await createEventType(app, { durationMinutes: 30 })
    const startAt = "2026-10-06T09:00:00+03:00"

    const first = await post(app, "/api/bookings", bookingPayload(type.id, startAt))
    expect(first.status).toBe(201)

    const second = await post(app, "/api/bookings", bookingPayload(type.id, startAt))
    expect(second.status).toBe(409)
    expect((await errorEnvelope(second)).code).toBe("SLOT_TAKEN")
  })

  test("§4: время занято другим типом события → 409 SLOT_TAKEN", async () => {
    const app = createApp({ dbPath: tempDbPath() })
    const long = await createEventType(app, { name: "Разбор", durationMinutes: 45 })
    const short = await createEventType(app, { name: "Созвон", durationMinutes: 30 })

    // Чужое бронирование занимает [10:00, 10:45) другим типом события
    const foreign = await post(
      app,
      "/api/bookings",
      bookingPayload(long.id, "2026-10-06T10:00:00+03:00"),
    )
    expect(foreign.status).toBe(201)

    // Старт 10:30 пересекается с чужим отрезком → на одно время одно
    // бронирование, даже у разных типов событий (§4)
    const conflict = await post(
      app,
      "/api/bookings",
      bookingPayload(short.id, "2026-10-06T10:30:00+03:00"),
    )
    expect(conflict.status).toBe(409)
    expect((await errorEnvelope(conflict)).code).toBe("SLOT_TAKEN")
  })
})

describe("§8 startAt — 400 VALIDATION_ERROR", () => {
  /** Проверяет, что старт отклонён как 400 с именем поля из контракта. */
  async function expectStartRejected(
    app: ReturnType<typeof createApp>,
    eventTypeId: string,
    startAt: string,
  ): Promise<void> {
    const response = await post(app, "/api/bookings", bookingPayload(eventTypeId, startAt))
    expect(response.status).toBe(400)
    const error = await errorEnvelope(response)
    expect(error.code).toBe("VALIDATION_ERROR")
    expect(error.message).toContain("startAt")
  }

  test("§8: startAt не на сетке → 400 VALIDATION_ERROR", async () => {
    const app = createApp({ dbPath: tempDbPath() })
    const type = await createEventType(app, { durationMinutes: 30 })

    await expectStartRejected(app, type.id, "2026-10-06T09:15:00+03:00")
  })

  test("§8: startAt вне окна 14 дней → 400 VALIDATION_ERROR", async () => {
    const app = createApp({ dbPath: tempDbPath() })
    const type = await createEventType(app, { durationMinutes: 30 })

    // Сегодня+15 МСК — за пределами окна [сегодня, сегодня+14] (§4)
    await expectStartRejected(app, type.id, "2026-10-21T09:00:00+03:00")
  })

  test("§8: startAt в прошлом → 400 VALIDATION_ERROR", async () => {
    setSystemTime(new Date("2026-10-06T10:00:00+03:00"))
    const app = createApp({ dbPath: tempDbPath() })
    const type = await createEventType(app, { durationMinutes: 30 })

    // 09:00 того же дня: на сетке и в окне, но уже прошло (§4)
    await expectStartRejected(app, type.id, "2026-10-06T09:00:00+03:00")
  })

  test("§8: startAt не помещается до 18:00 → 400 VALIDATION_ERROR", async () => {
    const app = createApp({ dbPath: tempDbPath() })
    const type = await createEventType(app, { durationMinutes: 45 })

    // 45 минут от 17:30 кончаются в 18:15 — такой старт не предлагается (§3)
    await expectStartRejected(app, type.id, "2026-10-06T17:30:00+03:00")
  })
})
