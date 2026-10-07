import { afterAll, describe, expect, test } from "bun:test"
import { createApp, OWNER_PASSWORD } from "../src/app"
import { errorEnvelope, post, removeTempDbs, tempDbPath, VALID_EVENT_TYPE } from "./support"

const VALID_BOOKING = {
  eventTypeId: "3f1d4f8a-1b7c-4f1e-9f3a-0b1c2d3e4f56",
  startAt: "2026-10-06T09:00:00+03:00",
  guestName: "Иван Петров",
  guestEmail: "ivan@example.com",
}

const app = createApp({ dbPath: tempDbPath() })

afterAll(() => {
  removeTempDbs()
})

describe("§8 Валидация и ошибки", () => {
  test("§8: durationMinutes вне 1..540 → 400 VALIDATION_ERROR с по-русски message", async () => {
    const response = await post(
      app,
      "/api/event-types",
      { ...VALID_EVENT_TYPE, durationMinutes: 541 },
      { "X-Admin-Password": OWNER_PASSWORD },
    )

    expect(response.status).toBe(400)
    const error = await errorEnvelope(response)
    expect(error.code).toBe("VALIDATION_ERROR")
    expect(error.message).toContain("durationMinutes")
    expect(error.message).toMatch(/[а-яё]/i)
  })

  test("§8: durationMinutes не целое число → 400 VALIDATION_ERROR", async () => {
    const response = await post(
      app,
      "/api/event-types",
      { ...VALID_EVENT_TYPE, durationMinutes: 45.5 },
      { "X-Admin-Password": OWNER_PASSWORD },
    )

    expect(response.status).toBe(400)
    expect((await errorEnvelope(response)).code).toBe("VALIDATION_ERROR")
  })

  test("§8: durationMinutes меньше 1 → 400 VALIDATION_ERROR", async () => {
    const response = await post(
      app,
      "/api/event-types",
      { ...VALID_EVENT_TYPE, durationMinutes: 0 },
      { "X-Admin-Password": OWNER_PASSWORD },
    )

    expect(response.status).toBe(400)
    expect((await errorEnvelope(response)).code).toBe("VALIDATION_ERROR")
  })

  test("§8: отсутствующий X-Admin-Password → 401 INVALID_ADMIN_PASSWORD", async () => {
    const response = await post(app, "/api/event-types", VALID_EVENT_TYPE)

    expect(response.status).toBe(401)
    expect((await errorEnvelope(response)).code).toBe("INVALID_ADMIN_PASSWORD")
  })

  test("§8: неверный пароль Владельца → 401 INVALID_ADMIN_PASSWORD", async () => {
    const response = await post(app, "/api/event-types", VALID_EVENT_TYPE, {
      "X-Admin-Password": "wrong-password",
    })

    expect(response.status).toBe(401)
    expect((await errorEnvelope(response)).code).toBe("INVALID_ADMIN_PASSWORD")
  })

  test("§8: неверный пароль → 401 даже при невалидном теле запроса", async () => {
    const response = await post(
      app,
      "/api/event-types",
      { ...VALID_EVENT_TYPE, durationMinutes: 0 },
      { "X-Admin-Password": "wrong-password" },
    )

    expect(response.status).toBe(401)
    expect((await errorEnvelope(response)).code).toBe("INVALID_ADMIN_PASSWORD")
  })

  test("§8: невалидный guestEmail → 400 VALIDATION_ERROR", async () => {
    const response = await post(app, "/api/bookings", {
      ...VALID_BOOKING,
      guestEmail: "не-email",
    })

    expect(response.status).toBe(400)
    expect((await errorEnvelope(response)).code).toBe("VALIDATION_ERROR")
  })

  test("§8: eventTypeId не UUID → 400 VALIDATION_ERROR", async () => {
    const response = await post(app, "/api/bookings", {
      ...VALID_BOOKING,
      eventTypeId: "не-uuid",
    })

    expect(response.status).toBe(400)
    expect((await errorEnvelope(response)).code).toBe("VALIDATION_ERROR")
  })

  test("§8: несуществующий тип события → 404 EVENT_TYPE_NOT_FOUND", async () => {
    const response = await post(app, "/api/bookings", VALID_BOOKING)

    expect(response.status).toBe(404)
    expect((await errorEnvelope(response)).code).toBe("EVENT_TYPE_NOT_FOUND")
  })

  test("§8: GET несуществующего типа события → 404 EVENT_TYPE_NOT_FOUND", async () => {
    const response = await app.handle(
      new Request(`http://localhost/api/event-types/${VALID_BOOKING.eventTypeId}`),
    )

    expect(response.status).toBe(404)
    expect((await errorEnvelope(response)).code).toBe("EVENT_TYPE_NOT_FOUND")
  })
})
