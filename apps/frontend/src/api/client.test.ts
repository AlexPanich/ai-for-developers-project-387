import { afterEach, expect, mock, test } from 'bun:test'
import { ApiError, request } from './client'
import type { components } from './schema'

const realFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = realFetch
})

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function mockFetch(handler: (input: RequestInfo | URL, init?: RequestInit) => Response) {
  const fetchMock = mock(handler)
  globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch
  return fetchMock
}

async function captureError(run: () => Promise<unknown>): Promise<ApiError> {
  try {
    await run()
  } catch (error) {
    if (error instanceof ApiError) {
      return error
    }
    throw error
  }
  throw new Error('Ожидалось исключение ApiError')
}

test('Обёртка fetch: успешный ответ возвращает типизированное тело', async () => {
  const body: components['schemas']['EventTypeList'] = {
    eventTypes: [
      {
        id: '3f1d4f8a-1b7c-4f1e-9f3a-0b1c2d3e4f56',
        name: 'Созвон',
        description: 'Разговор',
        durationMinutes: 45,
      },
    ],
  }
  const fetchMock = mockFetch(() => jsonResponse(200, body))

  const result = await request<components['schemas']['EventTypeList']>('/api/event-types')

  expect(result).toEqual(body)
  expect(fetchMock.mock.calls[0][0]).toBe('/api/event-types')
})

test('Обёртка fetch: конверт ошибки даёт ApiError с читаемым message и кодом', async () => {
  mockFetch(() =>
    jsonResponse(409, { error: { code: 'SLOT_TAKEN', message: 'Это время уже занято' } }),
  )

  const error = await captureError(() => request('/api/bookings', { method: 'POST' }))

  expect(error).toBeInstanceOf(ApiError)
  expect(error.message).toBe('Это время уже занято')
  expect(error.code).toBe('SLOT_TAKEN')
})

test('Обёртка fetch: ответ без конверта ошибки получает сообщение со статусом', async () => {
  mockFetch(() => jsonResponse(500, { unexpected: true }))

  const error = await captureError(() => request('/api/bookings'))

  expect(error.message).toBe('Сервер ответил ошибкой 500')
  expect(error.code).toBeNull()
})

test('Обёртка fetch: недоступный сервер даёт читаемое сообщение', async () => {
  mockFetch(() => {
    throw new TypeError('fetch failed')
  })

  const error = await captureError(() => request('/api/event-types'))

  expect(error.message).toBe('Не удалось связаться с сервером')
  expect(error.code).toBeNull()
})
