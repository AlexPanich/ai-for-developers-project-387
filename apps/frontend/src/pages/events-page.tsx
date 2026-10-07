import { useEffect, useState } from 'react'
import { messageFromError } from '@/api/client'
import type { operations } from '@/api/schema'
import { listBookings, type ResponseBody } from '@/api/sdk'
import { SiteHeader } from '@/components/site-header'
import { Card, CardContent } from '@/components/ui/card'
import { mskDateLabel, mskDayKey, mskTime } from '@/lib/msk'

/** Встреча списка: элемент `BookingList.bookings` — только тип и время (§6). */
type Booking = ResponseBody<operations['Bookings_list']>['bookings'][number]

/** Состояния страницы `/events`: загрузка, готовый список, ошибка API (§6). */
type PageState =
  | { status: 'loading' }
  | { status: 'ready'; bookings: Booking[] }
  | { status: 'error'; message: string }

export function EventsPage() {
  const [state, setState] = useState<PageState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    listBookings()
      .then((payload) => {
        if (!cancelled) setState({ status: 'ready', bookings: payload.bookings })
      })
      .catch((error: unknown) => {
        if (!cancelled) setState({ status: 'error', message: messageFromError(error) })
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="min-h-svh bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-tight">Предстоящие встречи</h1>

        {state.status === 'loading' ? (
          <p role="status" className="mt-6 text-muted-foreground">
            Загрузка…
          </p>
        ) : null}

        {state.status === 'error' ? (
          <p role="alert" className="mt-6 text-sm text-destructive">
            {state.message}
          </p>
        ) : null}

        {/* Надпись дословно из §6 — пустой список виден всем без входа */}
        {state.status === 'ready' && state.bookings.length === 0 ? (
          <p className="mt-6 text-muted-foreground">Нет предстоящих встреч</p>
        ) : null}

        {state.status === 'ready' && state.bookings.length > 0 ? (
          <ul className="mt-8 flex flex-col gap-3">
            {state.bookings.map((booking) => (
              // Встреча одна на старт (§4), поэтому старт — достаточный ключ строки
              <li key={booking.startAt}>
                <Card>
                  <CardContent className="flex flex-wrap items-center justify-between gap-2 p-4">
                    {/* §6: только тип и время, без имён и email гостя */}
                    <span className="font-medium">{booking.eventType.name}</span>
                    <span className="text-sm text-muted-foreground">
                      {meetingLabel(booking.startAt)}
                    </span>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        ) : null}
      </main>
    </div>
  )
}

/** Время встречи по Москве: «7 октября 2026 · 10:00» (§6: тип + время). */
function meetingLabel(startAt: string): string {
  const startMs = Date.parse(startAt)
  return `${mskDateLabel(mskDayKey(startMs))} · ${mskTime(startMs)}`
}
