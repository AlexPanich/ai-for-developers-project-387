/**
 * Правила приёма `POST /bookings` (SPEC §5, §8): `startAt` должен лежать на
 * сетке §3, внутри окна §4, не быть прошедшим и помещаться до 18:00; одно
 * время не бронируется дважды (§4), даже разными типами событий. Факты сетки,
 * окна и московского времени — из `availability.ts`, единого источника §3–§4.
 */

import {
  type BookingSpan,
  DAY_MS,
  GRID_END_MIN,
  GRID_START_MIN,
  GRID_STEP_MIN,
  mskDayStart,
  overlaps,
  toMskIso,
  WINDOW_DAYS,
} from "./availability"

const MINUTE_MS = 60_000

/** §8: почему `startAt` отклонён. Поле — из контракта, объяснение — по-русски. */
function invalidStart(reason: string): string {
  return `Некорректное поле: startAt — ${reason}`
}

export interface StartAtCheck {
  /** Значение поля из тела запроса (формат проверяет схема контракта). */
  startAt: string
  now: Date
  /** Длительность выбранного типа события: слот существует вместе с ней (§2). */
  durationMinutes: number
}

/**
 * Проверки `startAt` по §8 в порядке нарушений: сетка §3 → помещается до 18:00
 * → окно 14 дней §4 → не в прошлом. `null`, если нарушений нет.
 */
export function validateStartAt({ startAt, now, durationMinutes }: StartAtCheck): string | null {
  const startMs = Date.parse(startAt)
  if (Number.isNaN(startMs)) return invalidStart("не разбирается как дата и время")

  // Смещение старта от полуночи МСК его суток: сетка §3 считается по Москве,
  // смещение из строки запроса в расчёт не входит
  const dayStartMs = mskDayStart(startMs)
  const startOffsetMs = startMs - dayStartMs
  const stepMs = GRID_STEP_MIN * MINUTE_MS

  if (
    startOffsetMs < GRID_START_MIN * MINUTE_MS ||
    startOffsetMs >= GRID_END_MIN * MINUTE_MS ||
    startOffsetMs % stepMs !== 0
  ) {
    return invalidStart("старт должен лежать на сетке 09:00–17:30 с шагом 30 минут по Москве")
  }
  if (startOffsetMs + durationMinutes * MINUTE_MS > GRID_END_MIN * MINUTE_MS) {
    return invalidStart("с этого старта не помещается до 18:00 по Москве")
  }

  const dayIndex = Math.round((dayStartMs - mskDayStart(now.getTime())) / DAY_MS)
  if (dayIndex < 0 || dayIndex > WINDOW_DAYS) {
    return invalidStart("старт вне окна выбора 14 дней по Москве")
  }
  if (startMs < now.getTime()) {
    return invalidStart("этот старт уже прошёл")
  }
  return null
}

/**
 * §4: `[startAt, startAt + durationMinutes)` пересекается с интервалом хотя бы
 * одного существующего бронирования — в том числе созданного другим типом
 * события.
 */
export function isSlotTaken(
  startAt: string,
  durationMinutes: number,
  bookings: BookingSpan[],
): boolean {
  const startMs = Date.parse(startAt)
  const endMs = startMs + durationMinutes * MINUTE_MS
  return bookings.some((booking) => {
    const bookingStartMs = Date.parse(booking.startAt)
    const bookingEndMs = bookingStartMs + booking.durationMinutes * MINUTE_MS
    return overlaps(startMs, endMs, bookingStartMs, bookingEndMs)
  })
}

/**
 * Хранимое и возвращаемое время бронирования: московское смещение `+03:00`
 * (ADR 0001), чтобы в файле БД формат был один. На сетке §3 дробных секунд
 * не бывает, поэтому представление меняется без потери момента.
 */
export function normalizeStartAt(startAt: string): string {
  return toMskIso(Date.parse(startAt))
}
