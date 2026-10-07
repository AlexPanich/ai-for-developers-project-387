/**
 * Правила слотов (SPEC §3–§4): сетка стартов, скользящее окно 14 дней,
 * прошедшие старты и занятость по пересечению с бронированиями. Слоты не
 * хранятся — только считаются (ADR 0001). Факты сетки, окна и формат московского
 * времени здесь же переиспользует `booking.ts` — проверки `POST /bookings`.
 */

/** Москва: фиксированное смещение +03:00, локальный пояс сервера не участвует. */
const MSK_OFFSET_MS = 3 * 60 * 60 * 1000

/** Рабочий день 09:00–18:00 и шаг сетки 30 минут — §3. Общие с `booking.ts`. */
export const GRID_START_MIN = 9 * 60
export const GRID_END_MIN = 18 * 60
export const GRID_STEP_MIN = 30

/** Окно выбора: календарные сутки МСК [сегодня, сегодня+14] — §4. */
export const WINDOW_DAYS = 14

/** Сутки в миллисекундах: шаг окна §4. */
export const DAY_MS = 86_400_000

/** Занятость: бронирование занимает `[startAt, startAt + durationMinutes)` (§4). */
export interface BookingSpan {
  startAt: string
  durationMinutes: number
}

export interface Slot {
  startAt: string
  available: boolean
}

export interface BuildSlotsInput {
  now: Date
  durationMinutes: number
  bookings: BookingSpan[]
}

/**
 * Полночь МСК календарных суток, в которые попадает момент: сдвигаем момент
 * на +03:00 и округляем по UTC, затем возвращаем обратно — так граница суток
 * не зависит от пояса сервера (§4).
 */
export function mskDayStart(momentMs: number): number {
  return Math.floor((momentMs + MSK_OFFSET_MS) / DAY_MS) * DAY_MS - MSK_OFFSET_MS
}

/**
 * Слоты типа события на всё окно: старты сетки 09:00…17:30 МСК каждого дня
 * окна, что помещаются до 18:00. `available: false` у прошедших стартов
 * (остаются в списке) и у стартов, пересекающихся с чьей-то бронированием.
 */
export function buildSlots({ now, durationMinutes, bookings }: BuildSlotsInput): Slot[] {
  const nowMs = now.getTime()
  const todayMs = mskDayStart(nowMs)
  const durationMs = durationMinutes * 60_000
  const spans = bookings.map((booking) => {
    const startMs = Date.parse(booking.startAt)
    return { startMs, endMs: startMs + booking.durationMinutes * 60_000 }
  })

  const slots: Slot[] = []
  for (let day = 0; day <= WINDOW_DAYS; day++) {
    const dayStartMs = todayMs + day * DAY_MS
    for (
      let startMin = GRID_START_MIN;
      startMin + durationMinutes <= GRID_END_MIN;
      startMin += GRID_STEP_MIN
    ) {
      const startMs = dayStartMs + startMin * 60_000
      // Занятость §4: [S, S+d) пересекается с [start, start+duration)
      const busy = spans.some((span) =>
        overlaps(startMs, startMs + durationMs, span.startMs, span.endMs),
      )
      slots.push({
        startAt: toMskIso(startMs),
        available: startMs >= nowMs && !busy,
      })
    }
  }
  return slots
}

/** Эпоха → `YYYY-MM-DDTHH:mm:ss+03:00`: формат контракта, время московское. */
export function toMskIso(epochMs: number): string {
  const iso = new Date(epochMs + MSK_OFFSET_MS).toISOString()
  return `${iso.slice(0, 19)}+03:00`
}

/**
 * §4: `[aStart, aEnd)` пересекается с `[bStart, bEnd)`. Единственная формулировка
 * правила занятости — её же использует `booking.ts` для 409 SLOT_TAKEN.
 */
export function overlaps(
  aStartMs: number,
  aEndMs: number,
  bStartMs: number,
  bEndMs: number,
): boolean {
  return aStartMs < bEndMs && bStartMs < aEndMs
}
