import { afterEach, expect, test } from 'bun:test'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { AppRoutes } from './App'

afterEach(() => {
  // У RTL авто-cleanup не включается: в bun:test `afterEach` не глобальный
  cleanup()
})

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  )
}

function expectAllLinks(name: string, href: string) {
  const links = screen.getAllByRole('link', { name })
  expect(links.length).toBeGreaterThan(0)
  for (const link of links) {
    expect(link).toHaveAttribute('href', href)
  }
}

// Дословные надписи §6 лежат прямо в тестах — автотест Хекслета их не проверяет,
// смотрит наставник (issue #17).

test('§6: лендинг называет сервис «Календарь звонков»', () => {
  renderAt('/')

  expect(screen.getByRole('heading', { level: 1, name: 'Календарь звонков' })).toBeInTheDocument()
})

test('§6: описание сервиса называет рабочий день и выбор на 14 дней', () => {
  renderAt('/')

  const description = screen.getByText(/Гость выбирает тип события и бронирует слот/)
  expect(description).toHaveTextContent('09:00–18:00 по Москве')
  expect(description).toHaveTextContent('14 дней')
})

test('§6: кнопка «Забронировать» ведёт на /book', () => {
  renderAt('/')

  expectAllLinks('Забронировать', '/book')
})

test('§6: ссылка «Предстоящие встречи» ведёт на /events', () => {
  renderAt('/')

  expectAllLinks('Предстоящие встречи', '/events')
})

test('§6: факты лендинга — сетка §3, одно бронирование §4 и шаги §5', () => {
  renderAt('/')

  expect(
    screen.getByText('Слоты с шагом 30 минут: с 09:00 до 17:30 по Москве.'),
  ).toBeInTheDocument()
  expect(screen.getByText('На одно время — не больше одного бронирования.')).toBeInTheDocument()
  expect(
    screen.getByText('Бронирование в три шага: Календарь → Информация → Подтверждение записи.'),
  ).toBeInTheDocument()
})

test('§6: ссылка с именем сервиса ведёт на главную', () => {
  renderAt('/')

  expect(screen.getByRole('link', { name: 'Календарь звонков' })).toHaveAttribute('href', '/')
})
