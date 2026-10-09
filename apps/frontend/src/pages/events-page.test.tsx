import { afterEach, expect, mock, test } from 'bun:test'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { AppRoutes } from '@/App'

const realFetch = globalThis.fetch

/** Два бронирования разных типов: список встреч §7 собирает их в один список. */
const BOOKINGS = {
  bookings: [
    {
      eventType: { id: '3f1d4f8a-1b7c-4f1e-9f3a-0b1c2d3e4f56', name: 'Созвон' },
      startAt: '2026-10-07T10:00:00+03:00',
    },
    {
      eventType: { id: '6b0f2c7d-9e2a-4c3b-8d5e-1f2a3b4c5d6e', name: 'Разбор' },
      startAt: '2026-10-09T14:30:00+03:00',
    },
  ],
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function mockListBookings(response: Response) {
  const handler = mock((_input: RequestInfo | URL): Response => response)
  globalThis.fetch = handler as unknown as typeof globalThis.fetch
  return handler
}

function renderEvents() {
  return render(
    <MemoryRouter initialEntries={['/events']}>
      <AppRoutes />
    </MemoryRouter>,
  )
}

afterEach(() => {
  // У RTL авто-cleanup не включается: в bun:test `afterEach` не глобальный
  cleanup()
  globalThis.fetch = realFetch
})

test('§6: страница показывает тип события и время встречи по Москве', async () => {
  mockListBookings(jsonResponse(200, BOOKINGS))
  renderEvents()

  const items = await screen.findAllByRole('listitem')

  // §6: тип + время в каждой строке; состав строки задаёт контракт списка,
  // в ответе и в разметке данных гостя нет (их отсутствие проверяет бэкенд)
  expect(items[0]).toHaveTextContent('Созвон')
  expect(items[0]).toHaveTextContent('7 октября 2026 · 10:00')
  expect(items[1]).toHaveTextContent('Разбор')
  expect(items[1]).toHaveTextContent('9 октября 2026 · 14:30')
})

test('§7: встречи всех типов одним списком — один запрос и обе строки', async () => {
  const handler = mockListBookings(jsonResponse(200, BOOKINGS))
  renderEvents()

  const items = await screen.findAllByRole('listitem')
  expect(items).toHaveLength(2)
  expect(screen.getByRole('list')).toBeInTheDocument()
  expect(String(handler.mock.calls[0][0])).toBe('/api/bookings')
})

test('§6: пусто — «Нет предстоящих встреч»', async () => {
  mockListBookings(jsonResponse(200, { bookings: [] }))
  renderEvents()

  expect(await screen.findByText('Нет предстоящих встреч')).toBeInTheDocument()
  expect(screen.queryByRole('listitem')).not.toBeInTheDocument()
})

test('§6: список подписан «Время по Москве» — время не сравнивают с локальным календарём', async () => {
  mockListBookings(jsonResponse(200, BOOKINGS))
  renderEvents()

  expect(await screen.findByText('Время по Москве')).toBeInTheDocument()
})

test('§6: не-дата в `startAt` не даёт «NaN:NaN» в строке встречи', async () => {
  mockListBookings(
    jsonResponse(200, {
      bookings: [
        {
          eventType: { id: '3f1d4f8a-1b7c-4f1e-9f3a-0b1c2d3e4f56', name: 'Созвон' },
          startAt: 'not-a-date',
        },
      ],
    }),
  )
  renderEvents()

  const item = await screen.findByRole('listitem')
  expect(item).toHaveTextContent('Время не указано')
  expect(item).not.toHaveTextContent('NaN')
})
