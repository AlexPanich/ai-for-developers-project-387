import { join } from "node:path"
import { Elysia } from "elysia"
import type { components } from "./api/schema"
import * as S from "./api/schemas"
import { buildSlots } from "./availability"
import { isSlotTaken, normalizeStartAt, validateStartAt } from "./booking"
import { type Booking, openEventTypeStore } from "./storage"

/** Пароль Владельца (SPEC §7): на фронте та же константа в route guard (админка). */
export const OWNER_PASSWORD = "secret"

/** Рабочий файл БД рядом с пакетом (ADR 0001); тесты передают свой временный. */
export const DEFAULT_DB_PATH = join(import.meta.dir, "..", "data.db")

/** Создание типа события — единственный эндпоинт, обязательный к паролю Владельца (§7). */
const EVENT_TYPES_PATH = "/api/event-types"

type ErrorEnvelope = components["schemas"]["ErrorBody"]

function envelope(code: ErrorEnvelope["error"]["code"], message: string): ErrorEnvelope {
  return { error: { code, message } }
}

function validationMessage(error: unknown): string {
  const path = (error as { valueError?: { path?: unknown } } | null)?.valueError?.path
  if (typeof path !== "string" || path === "") {
    return "Некорректные данные запроса"
  }
  return `Некорректное поле: ${path.replace(/^\//, "").replaceAll("/", ".")}`
}

/** §8: несуществующий тип события → 404 EVENT_TYPE_NOT_FOUND. */
function notFound(ctx: { set: { status?: number | string } }): ErrorEnvelope {
  ctx.set.status = 404
  return envelope("EVENT_TYPE_NOT_FOUND", "Тип события не найден")
}

export function createApp(options: { dbPath?: string } = {}) {
  const store = openEventTypeStore(options.dbPath ?? DEFAULT_DB_PATH)

  // Роуты объявлены вручную и подставляют сгенерированные схемы
  // (body/params/ответы) как валидацию входа и сериализацию выхода — ADR 0002.
  return (
    new Elysia()
      .onError((ctx) => {
        if (ctx.code !== "VALIDATION") return

        ctx.set.status = 400
        return envelope("VALIDATION_ERROR", validationMessage(ctx.error))
      })
      .on("stop", () => store.close())
      // Пароль Владельца проверяется до валидации body: Elysia валидирует тело
      // раньше beforeHandle и хендлера, поэтому проверка живёт в самом раннем хуке —
      // неверный пароль даёт 401 даже при невалидном теле (§8), а 400 по схеме —
      // только при верном пароле. Сгенерированную схему заголовка
      // (S.parameters.EventTypes_create.header) не подставляем: она обязала бы
      // отвечать 400, а §8 требуют для отсутствующего или неверного пароля 401.
      .onRequest((ctx) => {
        const isOwnerEndpoint =
          ctx.request.method === "POST" && new URL(ctx.request.url).pathname === EVENT_TYPES_PATH
        if (!isOwnerEndpoint) return

        if (ctx.request.headers.get("X-Admin-Password") !== OWNER_PASSWORD) {
          ctx.set.status = 401
          return envelope("INVALID_ADMIN_PASSWORD", "Неверный пароль")
        }
      })
      // `/` API не принадлежит (в контракте его нет): главную отдаёт хост
      // (host.ts), в деве UI отдаёт Vite на 5173.
      .get(
        EVENT_TYPES_PATH,
        // Список типов для страницы `/book` (SPEC §6): без фильтрации, все строки
        () => ({ eventTypes: store.list() }),
        { response: { 200: S.EventTypeList } },
      )
      .post(
        EVENT_TYPES_PATH,
        (ctx) => {
          const created = {
            id: crypto.randomUUID(),
            name: ctx.body.name,
            description: ctx.body.description,
            durationMinutes: ctx.body.durationMinutes,
          }
          store.insert(created)
          ctx.set.status = 201
          return created
        },
        {
          body: S.EventTypeCreate,
          response: { 201: S.EventType, 400: S.ErrorBody, 401: S.ErrorBody },
        },
      )
      .get(
        "/api/event-types/:id",
        // Выборка типа из SQLite: нет строки → 404 (SPEC §8)
        (ctx) => store.get(ctx.params.id) ?? notFound(ctx),
        {
          params: S.parameters.EventTypes_get.path,
          response: { 200: S.EventType, 404: S.ErrorBody },
        },
      )
      .get(
        "/api/event-types/:id/availability",
        // Слоты считаются на лету: сетка и окно §3–§4 + занятость по бронированиям;
        // нет типа → 404 (SPEC §6, §8)
        (ctx) => {
          const type = store.get(ctx.params.id)
          if (!type) return notFound(ctx)

          return {
            slots: buildSlots({
              now: new Date(),
              durationMinutes: type.durationMinutes,
              bookings: store.bookingSpans(),
            }),
          }
        },
        {
          params: S.parameters.EventTypes_availability.path,
          response: { 200: S.Availability, 404: S.ErrorBody },
        },
      )
      .post(
        "/api/bookings",
        // Порядок §8: схема контракта ловит формат полей (400), затем существование
        // типа (404), затем правила `startAt` (400), затем занятость времени (409) —
        // в том числе занятость другим типом события (§4). Проверка занятости и
        // вставка идут в одной транзакции (ADR 0001).
        (ctx) => {
          const type = store.get(ctx.body.eventTypeId)
          if (!type) return notFound(ctx)

          const rejection = validateStartAt({
            startAt: ctx.body.startAt,
            now: new Date(),
            durationMinutes: type.durationMinutes,
          })
          if (rejection) {
            ctx.set.status = 400
            return envelope("VALIDATION_ERROR", rejection)
          }

          // Время храним московским (ADR 0001): на сетке §3 формат не несёт потерь
          const booking: Booking = {
            id: crypto.randomUUID(),
            eventTypeId: ctx.body.eventTypeId,
            startAt: normalizeStartAt(ctx.body.startAt),
            guestName: ctx.body.guestName,
            guestEmail: ctx.body.guestEmail,
          }

          const taken = store.transaction(() => {
            if (isSlotTaken(booking.startAt, type.durationMinutes, store.bookingSpans())) {
              return true
            }
            store.insertBooking(booking)
            return false
          })
          if (taken) {
            ctx.set.status = 409
            return envelope("SLOT_TAKEN", "Это время уже занято")
          }

          ctx.set.status = 201
          return booking
        },
        {
          body: S.BookingCreate,
          response: { 201: S.Booking, 400: S.ErrorBody, 404: S.ErrorBody, 409: S.ErrorBody },
        },
      )
      .get(
        "/api/bookings",
        // §6–§7: публичный список предстоящих встреч — все типы одним списком,
        // только тип события и время, без данных гостя. Прошедшие старты (уже
        // наступившие по Москве) отбрасываются по моменту времени; строки лежат
        // в таблице независимо от окна выбора §4 — сдвиг окна их не удаляет.
        () => {
          const nowMs = Date.now()
          const upcoming = store
            .listBookings()
            .filter((booking) => Date.parse(booking.startAt) > nowMs)
            .sort((left, right) => Date.parse(left.startAt) - Date.parse(right.startAt))

          return {
            bookings: upcoming.map((booking) => ({
              eventType: { id: booking.eventTypeId, name: booking.eventTypeName },
              startAt: booking.startAt,
            })),
          }
        },
        { response: { 200: S.BookingList } },
      )
  )
}
