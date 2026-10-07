import { cn } from 'cn'
import { type FormEvent, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { ApiError, messageFromError } from '@/api/client'
import type { operations } from '@/api/schema'
import { createBooking, getEventType, getEventTypeAvailability, type ResponseBody } from '@/api/sdk'
import { SiteHeader } from '@/components/site-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDuration } from '@/lib/duration'
import {
  MSK_DAY_MS,
  MSK_MONTHS_NOMINATIVE,
  mskDateLabel,
  mskDayKey,
  mskDayNumber,
  mskDayStart,
  mskMidnight,
  mskMonth,
  mskTime,
  mskWeekday,
} from '@/lib/msk'

/** Тип события контракта: `GET event-types/{id}` (§6). */
type EventType = ResponseBody<operations['EventTypes_get']>

/** Слот контракта: старт московским смещением и признак доступности (§4). */
type Slot = ResponseBody<operations['EventTypes_availability']>['slots'][number]

/** Состояния типа события: загрузка, готово, 404 типа, ошибка API (§6). */
type EventTypeState =
  | { status: 'loading' }
  | { status: 'ready'; eventType: EventType }
  | { status: 'not-found'; message: string }
  | { status: 'error'; message: string }

/** Состояния доступности: перезапрашивается при каждом показе «Календарь» (§5). */
type SlotsState =
  | { status: 'loading' }
  | { status: 'ready'; slots: Slot[] }
  | { status: 'error'; message: string }

/** Отправка формы: в полёте, «слот занят» (409) или прочая ошибка API (§8). */
type SubmitState =
  | { status: 'idle' }
  | { status: 'sending' }
  | { status: 'conflict'; message: string }
  | { status: 'error'; message: string }

interface Month {
  year: number
  month: number
}

interface DayCell {
  key: string
  day: number
  inWindow: boolean
  count: number
}

/** Окно выбора §4: календарные сутки МСК [сегодня, сегодня+14]. */
const WINDOW_DAYS = 14

/** Дословные названия шагов галереи (§5): глоссарь надписи интерфейса не регулирует. */
const STEPS = ['Календарь', 'Информация', 'Подтверждение записи'] as const

/** Шаг мастера и его позиция в списке шагов §5. */
type Step = 'calendar' | 'info' | 'confirmed'

const STEP_INDEX: Record<Step, number> = { calendar: 0, info: 1, confirmed: 2 }

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'] as const

/** §8: `guestEmail` обязателен и валиден — пустое или неверное не пускает дальше. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const fieldClass =
  'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring'
const labelClass = 'text-sm font-medium'
const primaryButtonClass =
  'rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:pointer-events-none disabled:opacity-50'
const secondaryButtonClass =
  'rounded-lg border border-border px-3 py-2 text-sm transition hover:bg-muted'

/** Мастер бронирования: три шага §5 — «Календарь», «Информация», «Подтверждение записи». */
export function BookingPage() {
  const { id } = useParams()
  const [typeState, setTypeState] = useState<EventTypeState>({ status: 'loading' })
  const [slotsState, setSlotsState] = useState<SlotsState>({ status: 'loading' })
  const [step, setStep] = useState<Step>('calendar')
  const [month, setMonth] = useState<Month>(() => mskMonth(Date.now()))
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [selectedStart, setSelectedStart] = useState<string | null>(null)
  const [guestName, setGuestName] = useState('')
  const [guestEmail, setGuestEmail] = useState('')
  const [submit, setSubmit] = useState<SubmitState>({ status: 'idle' })

  // Видимый шаг — производная от `step` и выбранного времени: сброс выбора
  // («Забронировать еще») возвращает на «Календарь». Показ шага и перезапрос
  // доступности обязаны следовать одной величине, иначе §5 рассинхронизируется.
  const activeStep: Step = step !== 'calendar' && selectedStart === null ? 'calendar' : step

  // Тип события — один запрос на показ страницы: его сводка нужна на всех шагах
  useEffect(() => {
    if (!id) return
    let cancelled = false
    setTypeState({ status: 'loading' })
    getEventType(id)
      .then((eventType) => {
        if (!cancelled) setTypeState({ status: 'ready', eventType })
      })
      .catch((error: unknown) => {
        if (cancelled) return
        const message = messageFromError(error)
        const missing = error instanceof ApiError && error.code === 'EVENT_TYPE_NOT_FOUND'
        setTypeState(missing ? { status: 'not-found', message } : { status: 'error', message })
      })
    return () => {
      cancelled = true
    }
  }, [id])

  // Доступность — при каждом показе шага «Календарь», включая возвраты с
  // «Информация» и «Подтверждение записи» (§5). Фонового опроса нет: устаревшую
  // конкуренцию догоняет 409 из §8.
  useEffect(() => {
    if (!id || activeStep !== 'calendar') return
    let cancelled = false
    setSlotsState({ status: 'loading' })
    getEventTypeAvailability(id)
      .then((availability) => {
        if (!cancelled) setSlotsState({ status: 'ready', slots: availability.slots })
      })
      .catch((error: unknown) => {
        if (!cancelled) setSlotsState({ status: 'error', message: messageFromError(error) })
      })
    return () => {
      cancelled = true
    }
  }, [id, activeStep])

  const todayStart = mskDayStart(Date.now())
  const badges = availableByDay(slotsState.status === 'ready' ? slotsState.slots : [])
  const cells = buildMonthCells(month, todayStart, badges)
  const daySlots =
    slotsState.status === 'ready' && selectedDay !== null
      ? slotsState.slots.filter((slot) => mskDayKey(Date.parse(slot.startAt)) === selectedDay)
      : []
  const durationMinutes = typeState.status === 'ready' ? typeState.eventType.durationMinutes : 0
  const range = selectedStart === null ? '' : slotRange(selectedStart, durationMinutes)

  function handleContinue() {
    if (selectedStart === null) return
    setSubmit({ status: 'idle' })
    setStep('info')
  }

  function handleBack() {
    setSubmit({ status: 'idle' })
    setStep('calendar')
  }

  function handleBookAgain() {
    // Возврат на «Календарь» перезапрашивает доступность (§5): слот уже занят
    setSubmit({ status: 'idle' })
    setSelectedDay(null)
    setSelectedStart(null)
    setStep('calendar')
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!id || selectedStart === null || !EMAIL_RE.test(guestEmail)) return
    if (submit.status === 'sending') return

    setSubmit({ status: 'sending' })
    try {
      await createBooking({
        eventTypeId: id,
        startAt: selectedStart,
        guestName,
        guestEmail,
      })
      setSubmit({ status: 'idle' })
      setStep('confirmed')
    } catch (error: unknown) {
      const message = messageFromError(error)
      // 409 — отдельное состояние «слот занят», остальные нарушения — §8
      const conflict = error instanceof ApiError && error.code === 'SLOT_TAKEN'
      setSubmit(conflict ? { status: 'conflict', message } : { status: 'error', message })
    }
  }

  return (
    <div className="min-h-svh bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-6 py-12">
        {typeState.status === 'not-found' ? (
          <>
            <h1 className="text-3xl font-semibold tracking-tight">404</h1>
            <p className="mt-6 text-sm text-muted-foreground">{typeState.message}</p>
          </>
        ) : (
          <>
            {/* Надпись дословно из галереи — так определяет §6 */}
            <h1 className="text-3xl font-semibold tracking-tight">Запись на звонок</h1>

            {typeState.status === 'loading' ? (
              <p role="status" className="mt-6 text-muted-foreground">
                Загрузка…
              </p>
            ) : null}

            {typeState.status === 'error' ? (
              <p role="alert" className="mt-6 text-sm text-destructive">
                {typeState.message}
              </p>
            ) : null}

            {typeState.status === 'ready' ? (
              <>
                <p className="mt-2 text-sm text-muted-foreground">
                  {`${typeState.eventType.name} · Длительность: ${formatDuration(typeState.eventType.durationMinutes)}`}
                </p>

                <ol className="mt-6 flex flex-wrap gap-4 text-sm">
                  {STEPS.map((stepName, index) => (
                    <li
                      key={stepName}
                      aria-current={index === STEP_INDEX[activeStep] ? 'step' : undefined}
                      className={
                        index === STEP_INDEX[activeStep]
                          ? 'font-medium text-foreground'
                          : 'text-muted-foreground'
                      }
                    >
                      {stepName}
                    </li>
                  ))}
                </ol>

                {activeStep === 'calendar' ? (
                  slotsState.status === 'error' ? (
                    <p role="alert" className="mt-6 text-sm text-destructive">
                      {slotsState.message}
                    </p>
                  ) : slotsState.status === 'loading' ? (
                    <p role="status" className="mt-6 text-muted-foreground">
                      Загрузка…
                    </p>
                  ) : (
                    <div className="mt-6 grid gap-6 lg:grid-cols-2">
                      <Card>
                        <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
                          <CardTitle>Календарь</CardTitle>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">Время по Москве</span>
                            <button
                              type="button"
                              aria-label="Предыдущий месяц"
                              onClick={() => setMonth(shiftMonth(month, -1))}
                              className="rounded-lg border border-border px-2.5 py-1 text-sm hover:bg-muted"
                            >
                              ←
                            </button>
                            <button
                              type="button"
                              aria-label="Следующий месяц"
                              onClick={() => setMonth(shiftMonth(month, 1))}
                              className="rounded-lg border border-border px-2.5 py-1 text-sm hover:bg-muted"
                            >
                              →
                            </button>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-muted-foreground">
                            {`${MSK_MONTHS_NOMINATIVE[month.month]} ${month.year} г.`}
                          </p>
                          <div className="mt-3 grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground">
                            {WEEKDAYS.map((weekday) => (
                              <span key={weekday}>{weekday}</span>
                            ))}
                          </div>
                          <div className="mt-1 grid grid-cols-7 gap-1">
                            {cells.map((cell) => (
                              <button
                                key={cell.key}
                                type="button"
                                disabled={!cell.inWindow}
                                aria-label={mskDateLabel(cell.key)}
                                onClick={() => {
                                  setSelectedDay(cell.key)
                                  setSelectedStart(null)
                                }}
                                className={cn(
                                  'flex flex-col items-start gap-0.5 rounded-lg border px-2 py-1.5 text-left text-sm transition',
                                  cell.inWindow
                                    ? 'border-border bg-card hover:border-primary'
                                    : 'cursor-not-allowed border-transparent bg-muted/30 text-muted-foreground opacity-60',
                                  selectedDay === cell.key && 'border-primary ring-1 ring-primary',
                                )}
                              >
                                <span>{cell.day}</span>
                                {cell.inWindow ? (
                                  <span className="text-[10px] leading-none text-muted-foreground">
                                    {cell.count} св.
                                  </span>
                                ) : null}
                              </button>
                            ))}
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle>Статус слотов</CardTitle>
                        </CardHeader>
                        <CardContent>
                          {selectedDay === null ? (
                            <p className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
                              Выберите дату в календаре.
                            </p>
                          ) : (
                            <>
                              <p className="text-sm font-medium">{mskDateLabel(selectedDay)}</p>
                              {daySlots.length === 0 ? (
                                <p className="mt-3 text-sm text-muted-foreground">
                                  Нет слотов на этот день
                                </p>
                              ) : (
                                <ul className="mt-3 flex flex-col gap-2">
                                  {daySlots.map((slot) => (
                                    <SlotRow
                                      key={slot.startAt}
                                      slot={slot}
                                      durationMinutes={durationMinutes}
                                      nowMs={Date.now()}
                                      selected={selectedStart === slot.startAt}
                                      onSelect={() =>
                                        setSelectedStart(
                                          selectedStart === slot.startAt ? null : slot.startAt,
                                        )
                                      }
                                    />
                                  ))}
                                </ul>
                              )}
                            </>
                          )}

                          <div className="mt-4 flex flex-wrap gap-2">
                            <Link to="/book" className={secondaryButtonClass}>
                              Назад
                            </Link>
                            <button
                              type="button"
                              disabled={selectedStart === null}
                              onClick={handleContinue}
                              className={primaryButtonClass}
                            >
                              Продолжить
                            </button>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )
                ) : null}

                {activeStep === 'info' && selectedStart !== null ? (
                  <div className="mt-6 max-w-xl">
                    <Card>
                      <CardHeader>
                        <CardTitle>Информация</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground">
                          {`${mskDateLabel(mskDayKey(Date.parse(selectedStart)))} · ${range} · Время по Москве`}
                        </p>

                        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
                          <label htmlFor="guest-name" className={labelClass}>
                            Имя
                          </label>
                          <input
                            id="guest-name"
                            className={fieldClass}
                            value={guestName}
                            onChange={(event) => setGuestName(event.target.value)}
                          />

                          <label htmlFor="guest-email" className={labelClass}>
                            Email
                          </label>
                          <input
                            id="guest-email"
                            type="email"
                            className={fieldClass}
                            value={guestEmail}
                            onChange={(event) => setGuestEmail(event.target.value)}
                          />

                          {submit.status === 'conflict' ? (
                            <div
                              role="alert"
                              className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
                            >
                              <p className="font-medium">Слот занят</p>
                              <p>{submit.message}</p>
                            </div>
                          ) : null}
                          {submit.status === 'error' ? (
                            <p role="alert" className="text-sm text-destructive">
                              {submit.message}
                            </p>
                          ) : null}

                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={handleBack}
                              className={secondaryButtonClass}
                            >
                              Назад
                            </button>
                            <button
                              type="submit"
                              disabled={!EMAIL_RE.test(guestEmail) || submit.status === 'sending'}
                              className={primaryButtonClass}
                            >
                              Подтвердить запись
                            </button>
                          </div>
                        </form>
                      </CardContent>
                    </Card>
                  </div>
                ) : null}

                {activeStep === 'confirmed' && selectedStart !== null ? (
                  <div className="mt-6 max-w-xl">
                    <Card>
                      <CardContent className="flex flex-col gap-4 p-6">
                        {/* Обе надписи дословно из галереи (§5) */}
                        <h2 className="text-xl font-semibold">Бронь подтверждена. До встречи!</h2>
                        <p className="text-sm text-muted-foreground">
                          {`${mskDateLabel(mskDayKey(Date.parse(selectedStart)))} · ${range} · Время по Москве`}
                        </p>
                        <button
                          type="button"
                          onClick={handleBookAgain}
                          className={`${primaryButtonClass} self-start`}
                        >
                          Забронировать еще
                        </button>
                      </CardContent>
                    </Card>
                  </div>
                ) : null}
              </>
            ) : null}
          </>
        )}
      </main>
    </div>
  )
}

/**
 * Строка слота: свободный — кнопка «Свободно», занятый — надпись «Занято»,
 * прошедший — приглушённый ряд без надписи и без кнопки (§5). Старт в
 * прошлом важнее признака доступности: серверный `available: false` никогда
 * не делает слот бронируемым (§5).
 */
function SlotRow({
  slot,
  durationMinutes,
  nowMs,
  selected,
  onSelect,
}: {
  slot: Slot
  durationMinutes: number
  nowMs: number
  selected: boolean
  onSelect: () => void
}) {
  const startMs = Date.parse(slot.startAt)
  const status = startMs < nowMs ? 'past' : slot.available ? 'free' : 'busy'
  const range = slotRange(slot.startAt, durationMinutes)

  return (
    <li className={status === 'past' ? 'opacity-50' : undefined}>
      {status === 'free' ? (
        <button
          type="button"
          aria-pressed={selected}
          onClick={onSelect}
          className={cn(
            'flex w-full items-center justify-between rounded-lg border bg-card px-3 py-2 text-sm transition hover:border-primary',
            selected ? 'border-primary ring-1 ring-primary' : 'border-border',
          )}
        >
          <span>{range}</span>
          <span>Свободно</span>
        </button>
      ) : (
        <div className="flex w-full items-center justify-between rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-sm">
          <span>{range}</span>
          {status === 'busy' ? <span>Занято</span> : null}
        </div>
      )}
    </li>
  )
}

/** Диапазон слота `HH:mm - HH:mm` по Москве — старт и конец по времени гостя (§5). */
function slotRange(startAt: string, durationMinutes: number): string {
  const startMs = Date.parse(startAt)
  return `${mskTime(startMs)} - ${mskTime(startMs + durationMinutes * 60_000)}`
}

/** Число слотов с `available: true` по суткам МСК — бейдж «N св.» (§5). */
function availableByDay(slots: Slot[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const slot of slots) {
    if (!slot.available) continue
    const key = mskDayKey(Date.parse(slot.startAt))
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return counts
}

/**
 * Месячная сетка: дни месяца и хвост соседних месяцев, по понедельникам.
 * Дата кликабельна и получает бейдж только внутри окна §4; вне окна ячейка
 * неактивна и бейджа не показывает (§5).
 */
function buildMonthCells(month: Month, todayStart: number, badges: Map<string, number>): DayCell[] {
  const firstStart = mskMidnight(month.year, month.month, 1)
  const leading = mskWeekday(firstStart)
  const daysInMonth = new Date(Date.UTC(month.year, month.month + 1, 0)).getUTCDate()
  const total = Math.ceil((leading + daysInMonth) / 7) * 7

  const cells: DayCell[] = []
  for (let index = 0; index < total; index++) {
    const dayStart = firstStart + (index - leading) * MSK_DAY_MS
    const key = mskDayKey(dayStart)
    const sinceToday = Math.round((dayStart - todayStart) / MSK_DAY_MS)
    cells.push({
      key,
      day: mskDayNumber(dayStart),
      inWindow: sinceToday >= 0 && sinceToday <= WINDOW_DAYS,
      count: badges.get(key) ?? 0,
    })
  }
  return cells
}

/** Сдвиг месяца на ±1: сетка листается и за границы окна (§5). */
function shiftMonth(month: Month, delta: number): Month {
  const shifted = month.month + delta
  return {
    year: month.year + Math.floor(shifted / 12),
    month: ((shifted % 12) + 12) % 12,
  }
}
