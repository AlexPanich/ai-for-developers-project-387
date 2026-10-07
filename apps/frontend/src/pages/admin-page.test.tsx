import { afterEach, expect, mock, test } from 'bun:test'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { AppRoutes } from '@/App'
import { OWNER_PASSWORD } from '@/pages/admin-page'

const realFetch = globalThis.fetch

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

function mockFetch(
  handler: (input: RequestInfo | URL, init?: RequestInit) => Response = () =>
    jsonResponse(201, {
      id: '3f1d4f8a-1b7c-4f1e-9f3a-0b1c2d3e4f56',
      name: 'Созвон',
      description: 'Разговор',
      durationMinutes: 45,
    }),
) {
  const fetchMock = mock(handler)
  globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch
  return fetchMock
}

function renderAdmin() {
  return render(
    <MemoryRouter initialEntries={['/admin']}>
      <AppRoutes />
    </MemoryRouter>,
  )
}

function unlock(password: string) {
  fireEvent.change(screen.getByLabelText('Пароль'), { target: { value: password } })
  fireEvent.click(screen.getByRole('button', { name: 'Войти' }))
}

function fillForm() {
  fireEvent.change(screen.getByLabelText('Название'), { target: { value: 'Созвон' } })
  fireEvent.change(screen.getByLabelText('Описание'), { target: { value: 'Разговор по делу' } })
  fireEvent.change(screen.getByLabelText('Длительность в минутах'), {
    target: { value: '45' },
  })
}

test('§7: без верного пароля форма создания недоступна и API не вызывается', () => {
  const fetchMock = mockFetch()
  renderAdmin()

  expect(screen.queryByLabelText('Название')).not.toBeInTheDocument()

  unlock('wrong-password')

  expect(screen.getByRole('alert')).toHaveTextContent('Неверный пароль')
  expect(screen.queryByLabelText('Название')).not.toBeInTheDocument()
  expect(fetchMock).not.toHaveBeenCalled()
})

test('§7: верный пароль открывает форму создания типа события', () => {
  mockFetch()
  renderAdmin()

  unlock(OWNER_PASSWORD)

  expect(screen.getByLabelText('Название')).toBeInTheDocument()
  expect(screen.getByLabelText('Описание')).toBeInTheDocument()
  expect(screen.getByLabelText('Длительность в минутах')).toBeInTheDocument()
  // #33: guard остаётся в DOM скрытым — удаление password-поля в том же коммите,
  // что и монтирование формы, приводит к secure input в Chrome и блокировке раскладки macOS.
  // В юнит-тестах нет CSS, поэтому проверяем класс hidden напрямую.
  expect(screen.getByLabelText('Пароль').closest('.hidden')).not.toBeNull()
})

test('§7: успех — пароль уходит в заголовке API, форма готова к следующему созданию', async () => {
  const fetchMock = mockFetch()
  renderAdmin()
  unlock(OWNER_PASSWORD)
  fillForm()

  fireEvent.click(screen.getByRole('button', { name: 'Создать' }))

  expect(await screen.findByRole('status')).toHaveTextContent('Тип события создан')

  expect(fetchMock).toHaveBeenCalledTimes(1)
  const [input, init] = fetchMock.mock.calls[0]
  expect(input).toBe('/api/event-types')
  const headers = init?.headers as Record<string, string>
  expect(headers['X-Admin-Password']).toBe(OWNER_PASSWORD)
  expect(JSON.parse(String(init?.body))).toEqual({
    name: 'Созвон',
    description: 'Разговор по делу',
    durationMinutes: 45,
  })

  expect(screen.getByLabelText('Название')).toHaveValue('')
  expect(screen.getByLabelText('Описание')).toHaveValue('')
})

test('§7: текст ошибки API виден на форме', async () => {
  mockFetch(() =>
    jsonResponse(400, {
      error: { code: 'VALIDATION_ERROR', message: 'Некорректное поле: durationMinutes' },
    }),
  )
  renderAdmin()
  unlock(OWNER_PASSWORD)
  fillForm()

  fireEvent.click(screen.getByRole('button', { name: 'Создать' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Некорректное поле: durationMinutes')
})

// Константа одна на обе стороны (§7): бэкенд сверяет ею X-Admin-Password, а здесь —
// guard и заголовок запроса. Если пароли разойдутся, Владелец потеряет доступ,
// поэтому дрейф ловится тестами с обеих сторон.
test('§7: пароль фронта — «secret», как в бэкенде', () => {
  expect(OWNER_PASSWORD).toBe('secret')
})
