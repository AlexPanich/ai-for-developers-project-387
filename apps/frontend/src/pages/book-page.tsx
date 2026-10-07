import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { messageFromError } from '@/api/client'
import type { operations } from '@/api/schema'
import { listEventTypes, type ResponseBody } from '@/api/sdk'
import { SiteHeader } from '@/components/site-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDuration } from '@/lib/duration'

/** Тип события из контракта: элемент `EventTypeList.eventTypes`. */
type EventType = ResponseBody<operations['EventTypes_list']>['eventTypes'][number]

/** Состояния страницы `/book`: загрузка списка, готовый список или ошибка API (§6). */
type PageState =
  | { status: 'loading' }
  | { status: 'ready'; eventTypes: EventType[] }
  | { status: 'error'; message: string }

export function BookPage() {
  const [state, setState] = useState<PageState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    listEventTypes()
      .then((payload) => {
        if (!cancelled) setState({ status: 'ready', eventTypes: payload.eventTypes })
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
        <h1 className="text-3xl font-semibold tracking-tight">Типы событий</h1>

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

        {state.status === 'ready' && state.eventTypes.length === 0 ? (
          <p className="mt-6 text-muted-foreground">Нет доступных типов событий</p>
        ) : null}
        {state.status === 'ready' && state.eventTypes.length > 0 ? (
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {state.eventTypes.map((type) => (
              <li key={type.id}>
                <Link
                  to={`/book/${type.id}`}
                  className="block rounded-xl outline-none transition hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring"
                >
                  <Card>
                    <CardHeader>
                      <CardTitle>{type.name}</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-2">
                      <p className="text-sm text-muted-foreground">{type.description}</p>
                      <p className="text-sm font-medium">
                        {`Длительность: ${formatDuration(type.durationMinutes)}`}
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </main>
    </div>
  )
}
