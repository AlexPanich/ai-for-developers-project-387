import { GlobalRegistrator } from '@happy-dom/global-registrator'

// Регистрируем DOM до того, как загрузится @testing-library/*:
// иначе screen создаётся в момент импорта модуля, когда document ещё нет
GlobalRegistrator.register()

// React 19 требует эту настройку для act() в тестах
;(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

// @ts-expect-error Resolved by Bun at runtime; TypeScript may not include Bun types.
const { expect } = await import('bun:test')
const matchers = await import('@testing-library/jest-dom/matchers')

// Матчеры .toBeInTheDocument(), .toHaveClass() и т.д.
expect.extend(matchers)
