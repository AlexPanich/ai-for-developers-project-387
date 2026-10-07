import { afterAll, afterEach, beforeEach, describe, expect, setSystemTime, test } from "bun:test"
import { createApp } from "../src/app"
import { bookingPayload, createEventType, get, post, removeTempDbs, tempDbPath } from "./support"

/** Замороженное «сейчас»: вторник утром, окно §4 — сутки МСК 2026-10-06…2026-10-20. */
const NOW = new Date("2026-10-06T08:00:00+03:00")

/** Элемент списка `GET /bookings`: только тип события и время (§6, §7). */
interface BookingListItem {
  eventType: { id: string; name: string }
  startAt: string
}

/** Предстоящие встречи: отвечает 200 или падает с кодом ответа. */
async function upcoming(
  app: ReturnType<typeof createApp>,
): Promise<{ bookings: BookingListItem[] }> {
  const response = await get(app, "/api/bookings")
  expect(response.status).toBe(200)
  return (await response.json()) as { bookings: BookingListItem[] }
}

/** Ставит бронирование через HTTP: тип уже существует, время берётся из запроса. */
async function book(
  app: ReturnType<typeof createApp>,
  eventTypeId: string,
  startAt: string,
): Promise<void> {
  const response = await post(app, "/api/bookings", bookingPayload(eventTypeId, startAt))
  expect(response.status).toBe(201)
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

describe("§6–§7 Предстоящие встречи", () => {
  test("§7: все типы одним списком, по времени, только тип события и старт", async () => {
    const app = createApp({ dbPath: tempDbPath() })
    const first = await createEventType(app, { name: "Созвон", durationMinutes: 30 })
    const second = await createEventType(app, { name: "Разбор", durationMinutes: 45 })
    await book(app, first.id, "2026-10-08T11:00:00+03:00")
    await book(app, second.id, "2026-10-07T09:30:00+03:00")

    const { bookings } = await upcoming(app)

    // Один список всех типов, в хронологическом порядке (§7)
    expect(bookings).toHaveLength(2)
    expect(bookings[0]).toEqual({
      eventType: { id: second.id, name: "Разбор" },
      startAt: "2026-10-07T09:30:00+03:00",
    })
    expect(bookings[1]).toEqual({
      eventType: { id: first.id, name: "Созвон" },
      startAt: "2026-10-08T11:00:00+03:00",
    })
  })

  test("§6: имён и email гостей в ответе нет", async () => {
    const app = createApp({ dbPath: tempDbPath() })
    const type = await createEventType(app)
    await book(app, type.id, "2026-10-07T10:00:00+03:00")

    const response = await get(app, "/api/bookings")
    const raw = JSON.stringify(await response.json())

    // Публичный список виден всем (§6, §7): данные гостя в него не попадают
    expect(raw).not.toContain("guestName")
    expect(raw).not.toContain("guestEmail")
    expect(raw).not.toContain("Иван Петров")
    expect(raw).not.toContain("ivan@example.com")
  })

  test("§6: встреча показывается, пока старт не наступил; наступившая — исчезает", async () => {
    const app = createApp({ dbPath: tempDbPath() })
    const type = await createEventType(app, { durationMinutes: 30 })
    await book(app, type.id, "2026-10-06T09:00:00+03:00")
    await book(app, type.id, "2026-10-07T09:00:00+03:00")

    // Ровно старт: он уже наступил — остаётся только встреча 07 октября
    setSystemTime(new Date("2026-10-06T09:00:00+03:00"))
    const atStart = await upcoming(app)
    expect(atStart.bookings.map((booking) => booking.startAt)).toEqual([
      "2026-10-07T09:00:00+03:00",
    ])

    // По Москве 10:00: старт 09:00 прошедший, встречи на 07 октября — ещё нет
    setSystemTime(new Date("2026-10-06T10:00:00+03:00"))
    const later = await upcoming(app)
    expect(later.bookings.map((booking) => booking.startAt)).toEqual(["2026-10-07T09:00:00+03:00"])
  })

  test("§4: бронирование переживает сдвиг окна выбора — список его не теряет", async () => {
    const app = createApp({ dbPath: tempDbPath() })
    const type = await createEventType(app, { durationMinutes: 30 })
    await book(app, type.id, "2026-10-10T10:00:00+03:00")

    // Окно уехало на четыре сутки: день бронирования всё ещё внутри него (§4),
    // но и после сдвига окна строка остаётся в списке — окно ничего не удаляет
    setSystemTime(new Date("2026-10-10T08:00:00+03:00"))
    const { bookings } = await upcoming(app)

    expect(bookings.map((booking) => booking.startAt)).toEqual(["2026-10-10T10:00:00+03:00"])
  })

  test("§6: встреч нет — пустой список, а не ошибка", async () => {
    const app = createApp({ dbPath: tempDbPath() })

    const { bookings } = await upcoming(app)

    expect(bookings).toEqual([])
  })
})
