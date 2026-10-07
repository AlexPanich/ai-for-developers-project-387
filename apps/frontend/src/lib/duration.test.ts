import { expect, test } from 'bun:test'
import { formatDuration } from './duration'

// Склонение длительности для карточки (SPEC §6: карточка показывает длительность).
test('§6: длительность в карточке склоняется по-русски', () => {
  expect(formatDuration(1)).toBe('1 минута')
  expect(formatDuration(2)).toBe('2 минуты')
  expect(formatDuration(5)).toBe('5 минут')
  expect(formatDuration(11)).toBe('11 минут')
  expect(formatDuration(21)).toBe('21 минута')
  expect(formatDuration(45)).toBe('45 минут')
  expect(formatDuration(540)).toBe('540 минут')
})
