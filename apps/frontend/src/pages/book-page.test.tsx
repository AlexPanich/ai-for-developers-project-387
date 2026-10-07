import { afterEach, expect, mock, test } from 'bun:test'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router'
import { AppRoutes } from '@/App'

const realFetch = globalThis.fetch

const EVENT_TYPES = [
  {
    id: '3f1d4f8a-1b7c-4f1e-9f3a-0b1c2d3e4f56',
    name: 'Созвон',
    description: 'Разговор по делу',
    durationMinutes: 45,
  },
  {
    id: '6b0f2c7d-9e2a-4c3b-8d5e-1f2a3b4c5d6e',
    name: 'Разбор',
    description: 'Разбор ошибок',
    durationMinutes: 30,
  },
]

afterEach(() => {
  // У RTL авто-cleanup не включается: в bun:test `afterEach` не глобальный
  cleanup()
  globalThis.fetch = realFetch
})

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/**
 * Список типов, один тип и его доступность: после клика по карточке роут
 * `/book/:id` монтирует шаг «Календарь» и спрашивает оба эндпоинта.
 */
function defaultHandler(input: RequestInfo | URL): Response {
  const url = String(input)
  if (url === '/api/event-types') return jsonResponse(200, { eventTypes: EVENT_TYPES })
  if (url.endsWith('/availability')) return jsonResponse(200, { slots: [] })
  return jsonResponse(200, EVENT_TYPES[0])
}

function mockFetch(
  handler: (input: RequestInfo | URL, init?: RequestInit) => Response = defaultHandler,
) {
  const fetchMock = mock(handler)
  globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch
  return fetchMock
}

/** Показывает текущий путь после клика по карточке типа события. */
function PathnameProbe() {
  const location = useLocation()
  return <div data-testid="pathname">{location.pathname}</div>
}

function renderBook() {
  return render(
    <MemoryRouter initialEntries={['/book']}>
      <AppRoutes />
      <PathnameProbe />
    </MemoryRouter>,
  )
}

test('§6: карточки показывают название, описание и длительность типа', async () => {
  const fetchMock = mockFetch()
  renderBook()

  expect(await screen.findByText('Созвон')).toBeInTheDocument()
  expect(screen.getByText('Разговор по делу')).toBeInTheDocument()
  expect(screen.getByText('Длительность: 45 минут')).toBeInTheDocument()
  expect(screen.getByText('Разбор')).toBeInTheDocument()
  expect(screen.getByText('Длительность: 30 минут')).toBeInTheDocument()

  expect(String(fetchMock.mock.calls[0][0])).toBe('/api/event-types')
})

test('§6: пустой список — «Нет доступных типов событий»', async () => {
  mockFetch(() => jsonResponse(200, { eventTypes: [] }))
  renderBook()

  expect(await screen.findByText('Нет доступных типов событий')).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: /Созвон/ })).not.toBeInTheDocument()
})

test('§6: клик по типу ведёт на /book/:id', async () => {
  mockFetch()
  renderBook()

  const card = await screen.findByRole('link', { name: /Созвон/ })
  fireEvent.click(card)

  expect(screen.getByTestId('pathname')).toHaveTextContent(`/book/${EVENT_TYPES[0].id}`)
  // Ждём контент шага, чтобы обновление состояния нового роута было в act()
  expect(await screen.findByText('Выберите дату в календаре.')).toBeInTheDocument()
})

test('§8: фронт показывает error.message из конверта ошибки API', async () => {
  mockFetch(() =>
    jsonResponse(404, {
      error: { code: 'EVENT_TYPE_NOT_FOUND', message: 'Тип события не найден' },
    }),
  )
  renderBook()

  expect(await screen.findByRole('alert')).toHaveTextContent('Тип события не найден')
})
