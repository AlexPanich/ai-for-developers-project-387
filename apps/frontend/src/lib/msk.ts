/**
 * Московское время шага «Календарь» (SPEC §5): границы дат, ключи суток и
 * надписи времени считаются по фиксированному смещению +03:00 — пояс
 * клиента в расчётах не участвует, часы показываются московские.
 */

const MSK_OFFSET_MS = 3 * 60 * 60 * 1000

/** Сутки в миллисекундах: шаг окна §4 и шаг месячной сетки. */
export const MSK_DAY_MS = 86_400_000

/** Месяцы строчными — подпись месяца в календаре: «март 2026 г.». */
export const MSK_MONTHS_NOMINATIVE = [
  'январь',
  'февраль',
  'март',
  'апрель',
  'май',
  'июнь',
  'июль',
  'август',
  'сентябрь',
  'октябрь',
  'ноябрь',
  'декабрь',
] as const

/** Родительный падеж месяцев — дата: «6 октября 2026». */
export const MSK_MONTHS_GENITIVE = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
] as const

/** Полночь МСК календарных суток, в которые попадает момент. */
export function mskDayStart(epochMs: number): number {
  return Math.floor((epochMs + MSK_OFFSET_MS) / MSK_DAY_MS) * MSK_DAY_MS - MSK_OFFSET_MS
}

/** Полночь МСК заданных суток (месяц — 0…11, как в `Date`). */
export function mskMidnight(year: number, month: number, day: number): number {
  return Date.UTC(year, month, day) - MSK_OFFSET_MS
}

/** Ключ суток МСК `YYYY-MM-DD`: слоты группируются по датам календаря. */
export function mskDayKey(epochMs: number): string {
  const day = new Date(mskDayStart(epochMs) + MSK_OFFSET_MS)
  return `${day.getUTCFullYear()}-${pad(day.getUTCMonth() + 1)}-${pad(day.getUTCDate())}`
}

/** Число суток МСК (1…31) для метки дня в месячной сетке. */
export function mskDayNumber(dayStartMs: number): number {
  return new Date(dayStartMs + MSK_OFFSET_MS).getUTCDate()
}

/** День недели суток МСК: 0 — понедельник, 6 — воскресенье. */
export function mskWeekday(dayStartMs: number): number {
  return (new Date(dayStartMs + MSK_OFFSET_MS).getUTCDay() + 6) % 7
}

/** Календарный месяц МСК, в который попадает момент, — старт календаря. */
export function mskMonth(epochMs: number): { year: number; month: number } {
  const day = new Date(mskDayStart(epochMs) + MSK_OFFSET_MS)
  return { year: day.getUTCFullYear(), month: day.getUTCMonth() }
}

/** `HH:mm` по Москве: старт и конец слота показываются московскими (§5). */
export function mskTime(epochMs: number): string {
  const clock = new Date(epochMs + MSK_OFFSET_MS)
  return `${pad(clock.getUTCHours())}:${pad(clock.getUTCMinutes())}`
}

/** Дата из ключа суток МСК: «6 октября 2026» — подпись выбранной даты. */
export function mskDateLabel(dayKey: string): string {
  const [year = '', month = '1', day = ''] = dayKey.split('-')
  const monthName = MSK_MONTHS_GENITIVE[Number(month) - 1] ?? ''
  return `${Number(day)} ${monthName} ${year}`
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}
