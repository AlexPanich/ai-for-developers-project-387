import { Database } from "bun:sqlite"
import { expect } from "bun:test"
import { rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { OWNER_PASSWORD } from "../src/app"

/** Минимальный интерфейс приложения для тестов (без типовых параметров Elysia). */
export interface AppLike {
  handle(input: Request | string): Promise<Response>
}

/** Фикстура §7: валидное тело создания типа события. */
export const VALID_EVENT_TYPE = {
  name: "Созвон",
  description: "Разговор по делу",
  durationMinutes: 45,
}

/** Данные гостя фикстуры: поля контракта, которые требует `POST /bookings` (§5). */
export const GUEST = { guestName: "Иван Петров", guestEmail: "ivan@example.com" }

/** Тело `POST /bookings` (§5): тип, старт и данные гостя из фикстуры. */
export function bookingPayload(eventTypeId: string, startAt: string) {
  return { eventTypeId, startAt, ...GUEST }
}

const tempDbs: string[] = []

/** Временный файл БД на прогон: рабочий `data.db` тесты не трогают (AC #19). */
export function tempDbPath(): string {
  const path = join(tmpdir(), `calendar-test-${crypto.randomUUID()}.db`)
  tempDbs.push(path)
  return path
}

/** Удаляет временные файлы БД, созданные в этом прогоне; вызывать в afterAll. */
export function removeTempDbs(): void {
  for (const path of tempDbs.splice(0)) {
    rmSync(path, { force: true })
  }
}

/** Сколько типов событий лежит в файле БД: читает тот же файл, что и приложение. */
export function countEventTypes(dbPath: string): number {
  const db = new Database(dbPath, { readonly: true })
  try {
    const row = db.query("SELECT COUNT(*) AS count FROM event_types").get() as { count: number }
    return row.count
  } finally {
    db.close()
  }
}

/**
 * Вставляет строку в `bookings` напрямую в файл БД: setup теста занятости §4 не
 * должен зависеть от HTTP-пути (`POST /bookings`). Setup через фикстуру,
 * проверка — через HTTP-шов.
 */
export function insertBooking(
  dbPath: string,
  booking: { id: string; eventTypeId: string; startAt: string },
): void {
  const db = new Database(dbPath)
  try {
    // Гость берётся из фикстуры: API-путь тесты бронирования берут свой
    db.query(
      "INSERT INTO bookings (id, event_type_id, start_at, guest_name, guest_email) VALUES (?, ?, ?, ?, ?)",
    ).run(booking.id, booking.eventTypeId, booking.startAt, GUEST.guestName, GUEST.guestEmail)
  } finally {
    db.close()
  }
}

export function post(
  app: AppLike,
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
): Promise<Response> {
  return app.handle(
    new Request(`http://localhost${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
    }),
  )
}

/**
 * Создаёт тип события через API для Владельца (§7) и возвращает его id:
 * общая фикстура тестов, которым нужен существующий тип.
 */
export async function createEventType(
  app: AppLike,
  overrides: { name?: string; durationMinutes?: number } = {},
): Promise<{ id: string }> {
  const response = await post(
    app,
    "/api/event-types",
    { ...VALID_EVENT_TYPE, ...overrides },
    { "X-Admin-Password": OWNER_PASSWORD },
  )
  expect(response.status).toBe(201)
  return (await response.json()) as { id: string }
}

export function get(app: AppLike, path: string): Promise<Response> {
  return app.handle(new Request(`http://localhost${path}`))
}

export async function errorEnvelope(
  response: Response,
): Promise<{ code: string; message: string }> {
  const body = (await response.json()) as { error?: { code: string; message: string } }
  if (!body.error) {
    throw new Error(
      `Ожидался конверт { error: { code, message } }, пришло: ${JSON.stringify(body)}`,
    )
  }
  return body.error
}
