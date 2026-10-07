/**
 * Длительность типа события по-русски для карточки `/book` (SPEC §6):
 * 1 минута, 2 минуты, 5 минут, 11 минут, 21 минута.
 */
export function formatDuration(minutes: number): string {
  const lastTwo = minutes % 100
  const last = minutes % 10
  if (lastTwo >= 11 && lastTwo <= 14) return `${minutes} минут`
  if (last === 1) return `${minutes} минута`
  if (last >= 2 && last <= 4) return `${minutes} минуты`
  return `${minutes} минут`
}
